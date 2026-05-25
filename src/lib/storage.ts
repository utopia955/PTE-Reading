import { SavedQuestion } from "../types";
import { db, auth } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocFromServer,
  setDoc,
  deleteDoc,
  query,
  where
} from "firebase/firestore";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: When the application initially boots, test the connection via getDocFromServer
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. Client is offline.");
    }
  }
}
testConnection();

export class StorageManager {
  private static indexedDb: IDBDatabase | null = null;
  private static useFallback = false;
  private static isInitialized = false;

  public static async init(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve) => {
      let isResolved = false;
      const done = () => {
        if (!isResolved) {
          isResolved = true;
          this.isInitialized = true;
          resolve();
        }
      };

      const timeout = setTimeout(() => {
        console.warn("IndexedDB timeout. Safely switching to LocalStorage fallback.");
        this.useFallback = true;
        done();
      }, 1000);

      try {
        const req = indexedDB.open("PTE_Coach_Database", 1);
        req.onupgradeneeded = (e: any) => {
          const dbInstance = e.target.result;
          if (!dbInstance.objectStoreNames.contains("questions")) {
            dbInstance.createObjectStore("questions", { keyPath: "id" });
          }
        };
        req.onsuccess = (e: any) => {
          clearTimeout(timeout);
          this.indexedDb = e.target.result;
          done();
        };
        req.onerror = () => {
          clearTimeout(timeout);
          this.useFallback = true;
          done();
        };
      } catch (e) {
        clearTimeout(timeout);
        this.useFallback = true;
        done();
      }
    });
  }

  private static compressImage(base64: string): Promise<string> {
    return new Promise((resolve) => {
      if (!base64 || !base64.startsWith("data:image")) {
        return resolve(base64);
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 500;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.5));
        } else {
          resolve(base64);
        }
      };
      img.onerror = () => {
        resolve(base64);
      };
      img.src = base64;
    });
  }

  /**
   * Saves a question/card both locally (for speed/offline) and securely in Firestore if authenticated.
   */
  public static async save(q: SavedQuestion): Promise<boolean> {
    await this.init();
    
    // 1. Secure Cloud Sync if Authenticated
    const user = auth.currentUser;
    if (user) {
      const docPath = `questions/${q.id}`;
      try {
        const payload = {
          id: q.id,
          userId: user.uid,
          title: q.title || "Untitled Study Card",
          category: q.category || "TXT",
          date: q.date || new Date().toISOString(),
          timestamp: q.timestamp || Date.now(),
          note: q.note || "",
          status: q.status || "needs-review",
          images: q.images || [],
          rawResponse: q.rawResponse || "{}",
          isStarred: !!q.isStarred
        };

        await setDoc(doc(db, "questions", q.id), payload);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, docPath);
      }
    }

    // 2. Local database backup
    let savedToIDB = false;
    if (!this.useFallback && this.indexedDb) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.indexedDb!.transaction(["questions"], "readwrite");
          const store = tx.objectStore("questions");
          store.put(q);
          tx.oncomplete = () => resolve();
          tx.onerror = (e) => reject(e);
        });
        savedToIDB = true;
      } catch (e) {
        console.warn("IDB Save failed. Falling back to LocalStorage.", e);
      }
    }

    if (!savedToIDB) {
      try {
        const compressedImages: string[] = [];
        if (q.images && q.images.length > 0) {
          for (const img of q.images) {
            try {
              const comp = await this.compressImage(img);
              compressedImages.push(comp);
            } catch (err) {
              compressedImages.push(img);
            }
          }
        }
        const fbStr = localStorage.getItem("pte_fallback_history") || "[]";
        const fb: SavedQuestion[] = JSON.parse(fbStr);
        const qCopy: SavedQuestion = { ...q, images: compressedImages };
        const idx = fb.findIndex((x) => x.id === q.id);
        if (idx > -1) {
          fb[idx] = qCopy;
        } else {
          fb.push(qCopy);
        }
        localStorage.setItem("pte_fallback_history", JSON.stringify(fb));
      } catch (e) {
        console.error("Critical fallback persistence failure:", e);
      }
    }
    return true;
  }

  /**
   * Fetches the complete browsing history:
   * - If logged in: fetches from Firestore and auto-synchronizes/merges local items that aren't online.
   * - If logged out: fetches purely local history.
   */
  public static async getAll(): Promise<SavedQuestion[]> {
    await this.init();
    
    // Read local questions First
    let localResults: SavedQuestion[] = [];
    if (!this.useFallback && this.indexedDb) {
      try {
        localResults = await new Promise<SavedQuestion[]>((resolve, reject) => {
          const tx = this.indexedDb!.transaction(["questions"], "readonly");
          const req = tx.objectStore("questions").getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject();
        });
      } catch (e) {
        console.error("Error reading from IndexedDB", e);
      }
    }

    try {
      const fbStr = localStorage.getItem("pte_fallback_history") || "[]";
      const fb: SavedQuestion[] = JSON.parse(fbStr);
      const uniqueMap = new Map<string, SavedQuestion>();
      fb.forEach((item) => uniqueMap.set(item.id, item));
      localResults.forEach((item) => uniqueMap.set(item.id, item));
      localResults = Array.from(uniqueMap.values());
    } catch (e) {
      console.error("LocalStorage load error: ", e);
    }

    // Cloud Sync Flow
    const user = auth.currentUser;
    if (user) {
      const colPath = "questions";
      try {
        const qRef = query(collection(db, colPath), where("userId", "==", user.uid));
        const snapshot = await getDocs(qRef);
        const cloudQuestions: SavedQuestion[] = [];
        const cloudIds = new Set<string>();

        snapshot.forEach((snap) => {
          const data = snap.data();
          cloudQuestions.push({
            id: data.id,
            title: data.title,
            category: data.category,
            date: data.date,
            timestamp: data.timestamp,
            note: data.note,
            status: data.status,
            images: data.images || [],
            rawResponse: data.rawResponse,
            isStarred: !!data.isStarred
          });
          cloudIds.add(data.id);
        });

        // AUTO-SYNC/MERGE OFFLINE HISTORY:
        // If there are local cards that are not in the cloud yet, save them to Firestore!
        const unsyncedLocal = localResults.filter(l => !cloudIds.has(l.id));
        if (unsyncedLocal.length > 0) {
          console.log(`Auto-syncing ${unsyncedLocal.length} local search cards to the cloud...`);
          for (const card of unsyncedLocal) {
            try {
              await this.save(card);
              cloudQuestions.push(card);
            } catch (err) {
              console.error("Sync error for card " + card.id, err);
            }
          }
        }

        // Return combined list sorted descending by timestamp
        return cloudQuestions.sort((a, b) => b.timestamp - a.timestamp);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, colPath);
      }
    }

    // Return sorted local results if offline or signed out
    return localResults.sort((a, b) => b.timestamp - a.timestamp);
  }

  public static async get(id: string): Promise<SavedQuestion | null> {
    const all = await this.getAll();
    return all.find((x) => x.id === id) || null;
  }

  public static async delete(id: string): Promise<void> {
    await this.init();
    
    // 1. Delete cloud item if signed in
    const user = auth.currentUser;
    if (user) {
      const docPath = `questions/${id}`;
      try {
        await deleteDoc(doc(db, "questions", id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, docPath);
      }
    }

    // 2. Delete local backup
    if (!this.useFallback && this.indexedDb) {
      try {
        await new Promise<void>((resolve) => {
          const tx = this.indexedDb!.transaction(["questions"], "readwrite");
          tx.objectStore("questions").delete(id);
          tx.oncomplete = () => resolve();
        });
      } catch (e) {
        console.error("Error deleting from IndexedDB", e);
      }
    }
    try {
      const fbStr = localStorage.getItem("pte_fallback_history") || "[]";
      let fb: SavedQuestion[] = JSON.parse(fbStr);
      fb = fb.filter((x) => x.id !== id);
      localStorage.setItem("pte_fallback_history", JSON.stringify(fb));
    } catch (e) {
      console.error("Error deleting from LocalStorage fallback", e);
    }
  }
}

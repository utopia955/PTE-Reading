import { SavedQuestion } from "../types";

export class StorageManager {
  private static db: IDBDatabase | null = null;
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
          const db = e.target.result;
          if (!db.objectStoreNames.contains("questions")) {
            db.createObjectStore("questions", { keyPath: "id" });
          }
        };
        req.onsuccess = (e: any) => {
          clearTimeout(timeout);
          this.db = e.target.result;
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
      };
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

  public static async save(q: SavedQuestion): Promise<boolean> {
    await this.init();
    let savedToIDB = false;

    if (!this.useFallback && this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = this.db!.transaction(["questions"], "readwrite");
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
        let fb: SavedQuestion[] = JSON.parse(fbStr);
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

  public static async getAll(): Promise<SavedQuestion[]> {
    await this.init();
    let results: SavedQuestion[] = [];

    if (!this.useFallback && this.db) {
      try {
        results = await new Promise<SavedQuestion[]>((resolve, reject) => {
          const tx = this.db!.transaction(["questions"], "readonly");
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
      results.forEach((item) => uniqueMap.set(item.id, item));
      return Array.from(uniqueMap.values());
    } catch (e) {
      return results;
    }
  }

  public static async get(id: string): Promise<SavedQuestion | null> {
    const all = await this.getAll();
    return all.find((x) => x.id === id) || null;
  }

  public static async delete(id: string): Promise<void> {
    await this.init();
    if (!this.useFallback && this.db) {
      try {
        await new Promise<void>((resolve) => {
          const tx = this.db!.transaction(["questions"], "readwrite");
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

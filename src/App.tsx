import React, { useState, useEffect, useRef, useMemo } from "react";
import { SavedQuestion, QuestionCategory, MasteryStatus } from "./types";
import { StorageManager } from "./lib/storage";
import {
  MODELS,
  PROVIDERS,
  getModel,
  getProvider,
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER,
  type ProviderId,
} from "./lib/models";
import Sidebar from "./components/Sidebar";
import AnalysisWorkspace from "./components/AnalysisWorkspace";
import NotesModal from "./components/NotesModal";
import CollocationsHub from "./components/CollocationsHub";
import {
  GraduationCap,
  BookMarked,
  Compass,
  Upload,
  Settings,
  X,
  Trash2,
  Check,
  AlertTriangle,
  Sparkles,
  ArrowRight,
} from "lucide-react";

const compressClientImage = (dataUrl: string, maxW = 1200, maxH = 1200, quality = 0.85): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith("data:image")) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > maxW || h > maxH) {
        if (w > h) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        } else {
          w = Math.round((w * maxH) / h);
          h = maxH;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

export default function App() {
  const [questions, setQuestions] = useState<SavedQuestion[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Staging area for multi-image uploads
  const [stagedImages, setStagedImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeStep, setAnalyzeStep] = useState<number>(1);
  const [analyzeStatusText, setAnalyzeStatusText] = useState<string>("");
  const [analyzeSubStatusText, setAnalyzeSubStatusText] = useState<string>("");

  // Modals state
  const [isNoteModalOpen, setIsNoteModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState<boolean>(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Settings
  const [provider, setProvider] = useState<ProviderId>(DEFAULT_PROVIDER);
  const [apiModel, setApiModel] = useState<string>(DEFAULT_MODEL_ID);
  const [googleKey, setGoogleKey] = useState<string>("");
  const [openrouterKey, setOpenrouterKey] = useState<string>("");

  // Vocabulary & Collocations bank toggle
  const [isCollocationsReviewActive, setIsCollocationsReviewActive] = useState<boolean>(false);

  // Full focus mode layout
  const [isFullScreenAnalysis, setIsFullScreenAnalysis] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<{ id: string; message: string; type: "success" | "info" | "warning" | "error" }[]>([]);

  // Hidden file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial DB instantiation & Theme detection
  useEffect(() => {
    const initApp = async () => {
      // Local dark preference detection
      const savedTheme = localStorage.getItem("theme");
      if (savedTheme === "light") {
        setIsDarkMode(false);
        document.documentElement.classList.remove("dark");
      } else {
        setIsDarkMode(true);
        document.documentElement.classList.add("dark");
      }

      await StorageManager.init();
      const items = await StorageManager.getAll();
      setQuestions(items);

      // Load active config (migrating from the older single-key layout).
      const savedProvider = localStorage.getItem("selected_provider") as ProviderId | null;
      const savedModel = localStorage.getItem("selected_model");
      const validModel = MODELS.some((m) => m.id === savedModel) ? (savedModel as string) : DEFAULT_MODEL_ID;
      const gKey = localStorage.getItem("google_api_key") || localStorage.getItem("gemini_api_key") || "";
      const orKey = localStorage.getItem("openrouter_api_key") || "";
      setProvider(PROVIDERS.some((p) => p.id === savedProvider) ? (savedProvider as ProviderId) : DEFAULT_PROVIDER);
      setApiModel(validModel);
      setGoogleKey(gKey);
      setOpenrouterKey(orKey);
    };

    initApp();
  }, []);

  // Listen for Clipboard Paste Event (Rapid capture workflow)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as any;
        if (item && item.type && item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) imageFiles.push(blob as File);
        }
      }

      if (imageFiles.length > 0) {
        processFilesIntoStaging(imageFiles);
        showToast(`${imageFiles.length} screenshot(s) pasted and staged.`, "info");
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [stagedImages]);

  // Listen for physical 'Delete' key to remove active passage from history
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting delete keys if we are editing an input, note form, or modal
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.key === "Delete" && selectedQuestionId) {
        e.preventDefault();
        triggerDeleteConfirm(selectedQuestionId);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedQuestionId]);

  const showToast = (message: string, type: "success" | "info" | "warning" | "error" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    if (nextTheme) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropFiles = Array.from(e.dataTransfer.files) as File[];
    const files = dropFiles.filter((file) => file.type && file.type.startsWith("image/"));
    if (files.length > 0) {
      processFilesIntoStaging(files);
      showToast(`${files.length} screenshot(s) attached successfully.`, "success");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      processFilesIntoStaging(files);
      showToast(`${files.length} screenshot(s) added from file picker.`, "success");
    }
    e.target.value = ""; // Reset
  };

  const processFilesIntoStaging = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result && typeof e.target.result === "string") {
          const rawUrl = e.target.result;
          try {
            const compressed = await compressClientImage(rawUrl);
            setStagedImages((prev) => [...prev, compressed]);
          } catch (err) {
            setStagedImages((prev) => [...prev, rawUrl]);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeStagedImage = (index: number) => {
    setStagedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = async () => {
    if (stagedImages.length === 0) {
      showToast("Please attach or paste a reading question screenshot first.", "warning");
      return;
    }

    setIsAnalyzing(true);
    setAnalyzeStep(1);
    setAnalyzeStatusText("Auditing screenshot composition...");
    setAnalyzeSubStatusText(`Uploading ${stagedImages.length} staged source image(s) to multimodal pipeline...`);

    try {
      // Simulate micro transition
      setTimeout(() => {
        setAnalyzeStep(2);
        setAnalyzeStatusText("Performing English OCR & Transcript extraction...");
        setAnalyzeSubStatusText("Parsing text layout and isolating multiple choice bounds...");
      }, 700);

      // Call server backend proxy securely (hiding keys and parameters)
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: stagedImages,
          provider,
          model: apiModel,
          apiKey: provider === "openrouter" ? openrouterKey : googleKey,
        }),
      });

      if (!res.ok) {
        let msg = "Backend analyzer failed. Check your API key in Settings.";
        if (res.status === 413) {
          msg = "Screenshot payload is too large for Vercel's 4.5MB limit. Staged screenshots have been compressed mechanically, but try attaching a smaller or single screenshot.";
        } else if (res.status === 504) {
          msg = "Analysis timed out (Vercel gateway timeout). Please try again or choose a faster model like Gemini 3.1 Flash Lite.";
        } else {
          try {
            const errText = await res.text();
            let errBody;
            try {
              errBody = JSON.parse(errText);
            } catch (e) {
              console.error("Non-JSON Error Response:", errText);
              throw new Error(`Parsing failed. Body: ${errText.substring(0, 50)}`);
            }
            
            if (errBody?.error) {
              msg = errBody.error;
            } else {
              msg = `Backend serverless function issue (HTTP ${res.status}). Ensure your server environment keys are set up correctly on Vercel.`;
            }
          } catch (e) {
            msg = `Backend status failed (HTTP ${res.status}). Details: ${(e as Error).message}. Verify your API key in the settings panel or check your Vercel deployment logs.`;
          }
        }
        throw new Error(msg);
      }

      setAnalyzeStep(3);
      setAnalyzeStatusText("Categorizing syntactic & lexical patterns...");
      setAnalyzeSubStatusText("Organizing prepositions, collocations, and vocabulary contrasts...");

      const reportPayload = await res.json();

      setAnalyzeStep(4);
      setAnalyzeStatusText("Compiling custom structured study guide...");
      setAnalyzeSubStatusText("Finalizing explanations, translation matrices, and confidence indices...");

      const inferredCategory = reportPayload.step1_questionType?.includes("Reading & Writing")
        ? "FIB-RW"
        : reportPayload.step1_questionType?.includes("Reorder")
        ? "RO"
        : reportPayload.step1_questionType?.includes("Multiple Choice")
        ? "MCQ"
        : "FIB-R";

      const questionId = `question-${Date.now()}`;
      const titleCandidate = reportPayload.step1_questionType || `PTE Analysis ${new Date().toLocaleDateString("en-US")}`;

      const savedItem: SavedQuestion = {
        id: questionId,
        title: titleCandidate,
        category: inferredCategory as QuestionCategory,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        timestamp: Date.now(),
        note: "",
        status: "needs-review",
        images: stagedImages,
        rawResponse: JSON.stringify(reportPayload),
      };

      await StorageManager.save(savedItem);
      const updated = await StorageManager.getAll();
      setQuestions(updated);
      setSelectedQuestionId(questionId);
      setStagedImages([]);
      setIsFullScreenAnalysis(true);

      showToast("Advanced passage dissection completed successfully!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err?.message || "An exception occurred inside the analysis pipeline.", "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const refreshQuestions = async () => {
    const all = await StorageManager.getAll();
    setQuestions(all);
  };

  const handleUpdateNoteAndStatus = async (status: MasteryStatus, note: string) => {
    if (!selectedQuestionId) return;
    const current = questions.find((q) => q.id === selectedQuestionId);
    if (!current) return;

    const updated: SavedQuestion = {
      ...current,
      status,
      note,
    };

    await StorageManager.save(updated);
    const all = await StorageManager.getAll();
    setQuestions(all);
    setIsNoteModalOpen(false);
    showToast("Mastery status and study notes updated.", "success");
  };

  const triggerDeleteConfirm = (id: string) => {
    setDeleteId(id);
    setIsConfirmDeleteOpen(true);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    await StorageManager.delete(deleteId);
    const updated = await StorageManager.getAll();
    setQuestions(updated);
    setSelectedQuestionId(null);
    setIsConfirmDeleteOpen(false);
    setDeleteId(null);
    showToast("Passage study card removed from history.", "info");
  };

  const saveSettings = () => {
    localStorage.setItem("selected_provider", provider);
    localStorage.setItem("selected_model", apiModel);
    localStorage.setItem("google_api_key", googleKey);
    localStorage.setItem("openrouter_api_key", openrouterKey);
    localStorage.removeItem("gemini_api_key"); // migrated → google_api_key
    setIsSettingsModalOpen(false);
    showToast("AI provider & model configuration saved.", "success");
  };

  // Find currently selected question
  const currentQuestion = questions.find((q) => q.id === selectedQuestionId);

  // Compute total collocations currently indexed across history
  const totalCollocationsCount = useMemo(() => {
    return questions.reduce((sum, item) => {
      try {
        const pay = JSON.parse(item.rawResponse);
        return sum + (pay.step2_collocations?.length || 0);
      } catch (e) {
        return sum;
      }
    }, 0);
  }, [questions]);

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleFileDrop}
      className={`min-h-screen text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200 overflow-x-hidden flex flex-col md:flex-row bg-slate-50 dark:bg-[#090D1A]`}
    >
      {/* Toast Alert stack Container */}
      <div className="fixed bottom-6 left-6 z-[90] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          let bg = "bg-slate-900 border-slate-800 text-white";
          if (t.type === "success") bg = "bg-emerald-950/95 border-emerald-800 text-emerald-250";
          if (t.type === "warning") bg = "bg-amber-950/95 border-amber-800 text-amber-250";
          if (t.type === "error") bg = "bg-rose-950/95 border-rose-800 text-rose-250";
          return (
            <div
              key={t.id}
              className={`p-4 rounded-2xl border shadow-2xl flex items-center gap-3 text-xs font-bold leading-normal transition-all duration-300 transform translate-y-0 opacity-100 dir-ltr pointer-events-auto ${bg}`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* Modern Bento styled Navigation Sidebars */}
      {isSidebarOpen && (
        <Sidebar
          questions={questions}
          selectedQuestionId={selectedQuestionId}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          isDarkMode={isDarkMode}
          totalCollocations={totalCollocationsCount}
          onSelectQuestion={(id) => {
            setSelectedQuestionId(id);
            setIsCollocationsReviewActive(false);
          }}
          onFilterChange={(f) => setActiveFilter(f)}
          onSearchChange={(q) => setSearchQuery(q)}
          onToggleTheme={toggleTheme}
          onGoHome={() => {
            setSelectedQuestionId(null);
            setIsCollocationsReviewActive(false);
          }}
          onNewUploadTrigger={() => fileInputRef.current?.click()}
          onToggleCollocationsReview={() => setIsCollocationsReviewActive(true)}
          onDeleteQuestion={(id) => triggerDeleteConfirm(id)}
        />
      )}

      {/* Main workspace */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-[#090D1A] transition-colors duration-200 relative p-6">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between flex-shrink-0 gap-4 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-11 h-11 rounded-2xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/80 flex items-center justify-center text-slate-500 dark:text-slate-300 transition-all cursor-pointer box-border"
              title="Toggle Sidebar Menu"
            >
              <span className="text-xl">☰</span>
            </button>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 hidden sm:flex items-center justify-center">
              <BookMarked className="w-5 h-5" />
            </div>
            <button
              onClick={() => setSelectedQuestionId(null)}
              className="min-w-0 flex-1 text-left flex flex-col justify-center cursor-pointer bg-transparent border-none outline-none p-0 focus:outline-none"
              title="Return to home dashboard"
            >
              <h2 className="text-base font-black text-slate-900 dark:text-white truncate w-full hover:text-blue-600 transition-colors">
                PTE Core Academic & General Coach
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-full">
                Advanced structural passage dissection, collocations, and option explanations
              </p>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
            <button
              onClick={() => {
                setSelectedQuestionId(null);
                setIsCollocationsReviewActive(false);
              }}
              className="px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-705 bg-white dark:bg-[#1E293B] text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs font-bold"
            >
              Dashboard Home
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
            >
              <Settings className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline font-bold font-en">AI Settings & Keys</span>
            </button>
          </div>
        </header>

        {/* Input elements for selection */}
        <input
          type="file"
          id="hiddenFileInput"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Dynamic Inner Workspace body: styled in clean premium Bento layout cards */}
        <div className="flex-1 flex flex-col justify-start">
          
          {/* Bento Group Image Staging Workspace Card */}
          {stagedImages.length > 0 && (
            <div className="mb-6 bg-white dark:bg-[#1E293B] rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 relative overflow-hidden shadow-2xl">
              <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "radial-gradient(#2563eb 1.2px, transparent 1.2px)", backgroundSize: "24px 24px" }}></div>
              <div className="relative z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-750 pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                    <Upload className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-white">
                    Staged Screenshots for Batch Analysis
                  </h4>
                </div>
                <span className="text-xs bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 px-3 py-1 rounded-full font-bold">
                  {stagedImages.length} Image(s) Staged
                </span>
              </div>

              {/* Staging grids */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 relative z-10">
                {stagedImages.map((src, index) => (
                  <div
                    key={index}
                    className="relative rounded-2xl border border-slate-200 dark:border-slate-750 bg-slate-50 dark:bg-slate-900/60 p-2 flex items-center justify-center overflow-hidden group shadow-xs"
                  >
                    <img src={src} className="max-h-24 object-contain rounded-lg shadow-2xs" alt="" />
                    <button
                      onClick={() => removeStagedImage(index)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center text-xs shadow-lg transition-all cursor-pointer border-none"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-150 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-450 leading-relaxed font-semibold">
                  💡 Paste screenshots directly with <b>Ctrl+V</b> anywhere on the screen to stage them side-by-side.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setStagedImages([]);
                      showToast("Draft list has been cleared.", "info");
                    }}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                  >
                    Clear Draft
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-[#1E293B] dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-750 dark:text-white rounded-xl transition-all cursor-pointer"
                  >
                    + Add Question
                  </button>
                  <button
                    onClick={startAnalysis}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border-none animate-pulse hover:animate-none"
                  >
                    <Compass className="w-4 h-4" />
                    <span>Begin Parsing</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Running Process Indicator */}
          {isAnalyzing && (
            <div className="bg-white dark:bg-[#1E293B] rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 relative overflow-hidden transition-all duration-300 shadow-xl">
              <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "radial-gradient(#2563eb 1px, transparent 1px)", backgroundSize: "30px 30px" }}></div>
              <div className="max-w-xl mx-auto flex flex-col items-center justify-center text-center p-6 relative z-10">
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                    <Compass className="w-8 h-8 text-blue-500" />
                  </div>
                </div>
                <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2">{analyzeStatusText}</h4>
                 <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 max-w-sm leading-relaxed font-semibold">
                  {analyzeSubStatusText}
                 </p>

                {/* Progress metrics map */}
                <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                  {[
                    { number: 1, label: "Quality Audit" },
                    { number: 2, label: "OCR Transcribe" },
                    { number: 3, label: "Lexical Structuring" },
                    { number: 4, label: "Study Guide Build" },
                  ].map((step) => {
                    const active = analyzeStep >= step.number;
                    return (
                      <div
                        key={step.number}
                        className={`p-3 rounded-2xl border text-center transition-all duration-300 ${
                          active
                            ? "bg-blue-500/10 border-blue-400/30 text-blue-600 dark:text-blue-300 font-bold"
                            : "bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-600"
                        }`}
                      >
                        <span className="text-[10px] block mb-1">Step {step.number}</span>
                        <span className="text-xs">{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Active results panel inside bento dashboard */}
          {isCollocationsReviewActive && !isAnalyzing && (
            <div className="bg-white dark:bg-[#1E293B] rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 shadow-xl relative z-10 transition-all">
              <CollocationsHub
                questions={questions}
                onOpenQuestion={(id) => {
                  setSelectedQuestionId(id);
                  setIsCollocationsReviewActive(false);
                }}
                onClose={() => setIsCollocationsReviewActive(false)}
                onRefreshQuestions={refreshQuestions}
              />
            </div>
          )}

          {/* Empty desktop state / Onboarding layout formatted as a premium bento matrix */}
          {!isCollocationsReviewActive && !currentQuestion && !isAnalyzing && (
            <div className="max-w-4xl mx-auto w-full mt-4 space-y-6">
              
              {/* Premium Hero Bento Card */}
              <div className="bg-white dark:bg-[#1E293B] rounded-[32px] border border-slate-200 dark:border-slate-800 p-8 md:p-12 text-center relative overflow-hidden shadow-xl">
                <div className="absolute -top-32 -right-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
                <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

                <div className="relative z-10 space-y-4">
                  <div className="w-16 h-16 bg-gradient-to-tr from-blue-650 to-indigo-650 text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
                    <GraduationCap className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white pb-1">PTE Core Elite Reading Coach</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-405 max-w-lg mx-auto leading-relaxed font-semibold">
                    Paste screenshots of reading passages, fill-in-the-blanks, or reorder questions directly (<b>Ctrl+V</b>), or click below to launch an instant coaching report.
                  </p>

                  <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs hover:shadow-lg hover:shadow-blue-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Select Screenshot</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Enhanced active vocabulary and collocations database shortcut */}
              {totalCollocationsCount > 0 && (
                <div className="bg-gradient-to-r from-indigo-500/10 to-blue-500/10 dark:from-indigo-950/20 dark:to-blue-950/20 border-2 border-dashed border-indigo-200/60 dark:border-indigo-850 p-6 rounded-[24px] flex flex-col sm:flex-row items-center justify-between gap-4 select-none relative z-10 animate-fadeIn">
                  <div className="text-left">
                    <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span>Vocabulary Master Deck (Active)</span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                      You have extracted a total of <span className="text-indigo-650 dark:text-indigo-400 font-extrabold">{totalCollocationsCount} collocations</span> across your screenshots query. Ready to review?
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCollocationsReviewActive(true)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-705 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 border-none"
                  >
                    <span>Open Collocations Review</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Bento Grid Feature Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Feature 1: Multi-imaging */}
                <div className="bg-white dark:bg-[#1E293B] rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-xs">
                  <div className="space-y-2 text-left">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Multi-Modal Pipeline</span>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">Multi-Image Consolidation</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Combine multiple screenshot snippets or multi-page passages into a single structured training guide.
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1.5">
                    <span>💡 Direct Clipboard Paste Is Active</span>
                  </div>
                </div>

                {/* Feature 2: High fidelity TTS */}
                <div className="bg-white dark:bg-[#1E293B] rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-xs">
                  <div className="space-y-2 text-left">
                    <span className="text-[10px] font-bold text-teal-650 dark:text-teal-400 uppercase tracking-wider">Pronunciation Drill</span>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">Acoustic TTS Playback</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Listen to key academic segments, idioms, and collocations with high-fidelity, expressive English pronunciation.
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1.5">
                    <span>💡 Immersive Kore Speech Synth</span>
                  </div>
                </div>

                {/* Feature 3: Deep analysis */}
                <div className="bg-white dark:bg-[#1E293B] rounded-[24px] border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between shadow-xs">
                  <div className="space-y-2 text-left">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Passage dissection</span>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">Structural Parsing Matrix</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                      Pinpoint cohesive cohesive links, dependent prepositions, and strategic option elimination logic matching Pearson standards.
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1.5">
                    <span>💡 6-step deep academic coaching</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Active results panel inside bento dashboard */}
          {!isCollocationsReviewActive && currentQuestion && !isAnalyzing && (
            <AnalysisWorkspace
              question={currentQuestion}
              isFullScreenAnalysis={isFullScreenAnalysis}
              onToggleFullScreen={() => setIsFullScreenAnalysis(!isFullScreenAnalysis)}
              onOpenNoteModal={() => setIsNoteModalOpen(true)}
              onDeleteQuestion={(id) => triggerDeleteConfirm(id)}
            />
          )}

        </div>
      </main>

      {/* Settings Modal Component - Sleek & Beautiful */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[70] p-4 text-left">
          <div className="bg-white dark:bg-[#1E293B] rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm overflow-hidden text-left">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-white">Active AI settings</h3>
                  <p className="text-[10px] text-slate-400">Manage LLM parameters & API keys</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer border-none bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Provider selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">AI Provider:</label>
                <div className="grid grid-cols-2 gap-2">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setProvider(p.id)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        provider === p.id
                          ? "bg-blue-500/10 border-blue-400/50 text-blue-600 dark:text-blue-300"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400/40"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Model:</label>
                <select
                  value={apiModel}
                  onChange={(e) => setApiModel(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs p-3 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>

                {(() => {
                  const m = getModel(apiModel);
                  return (
                    <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">{m.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[m.limits.rpm, m.limits.tpm, m.limits.rpd].map((lim) => (
                          <span
                            key={lim}
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-500/25"
                          >
                            {lim}
                          </span>
                        ))}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          free tier
                        </span>
                      </div>
                      {!m.vision && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold leading-relaxed">
                          ⚠️ Image input may be limited on this model. Gemini 3.1 Flash Lite is recommended for screenshots.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* API keys */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Google AI Studio API Key:</label>
                <input
                  type="password"
                  value={googleKey}
                  placeholder={provider === "google" ? "Required for Google (or set on server)" : "Optional — also powers premium TTS"}
                  onChange={(e) => setGoogleKey(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-200 text-xs p-3 rounded-xl focus:outline-none focus:border-blue-500 text-left font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">OpenRouter API Key:</label>
                <input
                  type="password"
                  value={openrouterKey}
                  placeholder={provider === "openrouter" ? "Required for OpenRouter (or set on server)" : "Optional"}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-850 dark:text-slate-200 text-xs p-3 rounded-xl focus:outline-none focus:border-blue-500 text-left font-mono"
                />
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                Keys are stored only in this browser and sent directly to your chosen provider. Get a free key:{" "}
                <a
                  href={getProvider(provider).keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-500 hover:underline font-bold"
                >
                  {getProvider(provider).label} ↗
                </a>
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-950/40 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-705">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-5 py-2 text-xs font-bold text-slate-550 dark:text-slate-400 hover:bg-slate-150 dark:hover:bg-[#1E293B] rounded-xl transition-all cursor-pointer border-none bg-transparent"
              >
                Cancel
              </button>
              <button
                onClick={saveSettings}
                className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border-none"
              >
                <Check className="w-4 h-4" />
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation delete modal */}
      {isConfirmDeleteOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-[80] p-4 text-center">
          <div className="bg-white dark:bg-[#1E293B] rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-white mb-2">Delete Study Card</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                Are you sure you want to permanently delete this passage analysis card? This is irreversible.
              </p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-955 border-t border-slate-150 dark:border-slate-755 flex justify-center gap-2">
              <button
                onClick={() => {
                  setIsConfirmDeleteOpen(false);
                  setDeleteId(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1E293B] border border-slate-200 dark:border-slate-750 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/15 transition-all cursor-pointer border-none"
              >
                Yes, Delete Completely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Render Note / Status Editor modal inline */}
      {isNoteModalOpen && currentQuestion && (
        <NotesModal
          isOpen={isNoteModalOpen}
          onClose={() => setIsNoteModalOpen(false)}
          status={currentQuestion.status}
          note={currentQuestion.note}
          onSave={handleUpdateNoteAndStatus}
        />
      )}
    </div>
  );
}

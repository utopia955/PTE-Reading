import React, { useState, useEffect, useRef, useMemo } from "react";
import { SavedQuestion, CollocationItem } from "../types";
import { speak, stopSpeech } from "../lib/tts";
import {
  Volume2,
  Search,
  BookOpen,
  ArrowRight,
  Play,
  Loader2,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Brain,
  Award,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Trophy,
  Check,
  X,
  HelpCircle,
  Sparkle,
  Plus,
  Trash2,
} from "lucide-react";

interface CollocationsHubProps {
  questions: SavedQuestion[];
  onOpenQuestion: (id: string) => void;
  onClose: () => void;
  onRefreshQuestions?: () => void;
}

interface FlattenedCollocation extends CollocationItem {
  questionId: string;
  questionTitle: string;
  questionCategory: string;
}

interface QuizQuestion {
  collocation: FlattenedCollocation;
  type: "sentence" | "meaning";
  options: string[];
  correctOption: string;
}

export default function CollocationsHub({
  questions,
  onOpenQuestion,
  onClose,
  onRefreshQuestions,
}: CollocationsHubProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<"database" | "flashcards" | "quiz">("database");
  
  // Search and Category filters (affects all tabs)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // TTS State
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);

  // --- Manual Collocation Management States ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEnglishCollocation, setNewEnglishCollocation] = useState("");
  const [newPersianMeaning, setNewPersianMeaning] = useState("");
  const [newImportance, setNewImportance] = useState("Highly frequent in academic tasks");
  const [newExample, setNewExample] = useState("");
  const [associatedQuestionId, setAssociatedQuestionId] = useState("global");
  const [addError, setAddError] = useState("");
  const [isSubmittingCollocation, setIsSubmittingCollocation] = useState(false);

  // Save custom manual collocation
  const handleAddCollocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");

    if (!newEnglishCollocation.trim() || !newPersianMeaning.trim()) {
      setAddError("English collocation and Persian meaning are required.");
      return;
    }

    setIsSubmittingCollocation(true);

    try {
      const { StorageManager } = await import("../lib/storage");

      const newItem: CollocationItem = {
        englishCollocation: newEnglishCollocation.trim(),
        persianMeaning: newPersianMeaning.trim(),
        importance: newImportance.trim(),
        example: newExample.trim() || undefined,
      };

      let targetQuestion: SavedQuestion | undefined;

      if (associatedQuestionId === "global") {
        // Find or create virtual "manual-collocations" question
        const existingGlobal = questions.find((q) => q.id === "manual-collocations");
        if (existingGlobal) {
          targetQuestion = { ...existingGlobal };
        } else {
          targetQuestion = {
            id: "manual-collocations",
            title: "Global Custom Decks",
            category: "FIB-R",
            date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            timestamp: Date.now(),
            note: "A repository of your manually created collocations.",
            status: "mastered",
            images: [],
            rawResponse: JSON.stringify({
              step1_questionType: "Manual Decks",
              fullPassageTranslation: "مجموعه اختصاصی اصطلاحات و ترکیبات ثبت شده به صورت دستی.",
              step2_collocations: [],
              step3_sentenceParsing: [],
              step4_optionsBreakdown: [],
              step5_grammarTips: [],
              step6_finalAnswers: [],
              confidenceLevel: "High",
              confidenceReason: "User input",
            }),
          };
        }
      } else {
        const found = questions.find((q) => q.id === associatedQuestionId);
        if (found) {
          targetQuestion = { ...found };
        }
      }

      if (!targetQuestion) {
        throw new Error("Target question storage chunk not found.");
      }

      // Parse payload, append, Save
      const payload = JSON.parse(targetQuestion.rawResponse);
      const existingCollocations: CollocationItem[] = payload.step2_collocations || [];
      
      // Prevent duplicates
      const isDuplicate = existingCollocations.some(
        (c) => c.englishCollocation.toLowerCase() === newItem.englishCollocation.toLowerCase()
      );
      if (isDuplicate) {
        setAddError("This collocation already exists in the selected module.");
        setIsSubmittingCollocation(false);
        return;
      }

      payload.step2_collocations = [newItem, ...existingCollocations];
      targetQuestion.rawResponse = JSON.stringify(payload);

      await StorageManager.save(targetQuestion);

      // Reset form & close
      setNewEnglishCollocation("");
      setNewPersianMeaning("");
      setNewImportance("Highly frequent in academic tasks");
      setNewExample("");
      setAssociatedQuestionId("global");
      setAddError("");
      setIsAddModalOpen(false);

      if (onRefreshQuestions) {
        onRefreshQuestions();
      }
    } catch (err: any) {
      console.error(err);
      setAddError(err?.message || "Failed to persist collocation.");
    } finally {
      setIsSubmittingCollocation(false);
    }
  };

  // Delete/Remove custom collocation
  const handleRemoveCollocation = async (item: FlattenedCollocation) => {
    const confirmMessage = `Are you sure you want to delete collocation "${item.englishCollocation}"?`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const { StorageManager } = await import("../lib/storage");
      const targetQuestion = questions.find((q) => q.id === item.questionId);
      if (!targetQuestion) return;

      const updatedQuestion = { ...targetQuestion };
      const payload = JSON.parse(updatedQuestion.rawResponse);
      const existingCollocations: CollocationItem[] = payload.step2_collocations || [];

      // Filter out the deleted collocation
      payload.step2_collocations = existingCollocations.filter(
        (c) => c.englishCollocation.toLowerCase() !== item.englishCollocation.toLowerCase()
      );
      updatedQuestion.rawResponse = JSON.stringify(payload);

      await StorageManager.save(updatedQuestion);

      if (onRefreshQuestions) {
        onRefreshQuestions();
      }
    } catch (err) {
      console.error("Failed to delete collocation:", err);
    }
  };

  // --- Flatten all collocations from questions history ---
  const allCollocations: FlattenedCollocation[] = useMemo(() => {
    return questions.flatMap((q) => {
      try {
        const payload = JSON.parse(q.rawResponse);
        const collocations: CollocationItem[] = payload.step2_collocations || [];
        return collocations.map((col) => ({
          ...col,
          questionId: q.id,
          questionTitle: q.title || "Reading Analysis",
          questionCategory: q.category,
        }));
      } catch (e) {
        return [];
      }
    });
  }, [questions]);

  // Filter based on search criteria and category
  const filteredCollocations = useMemo(() => {
    return allCollocations.filter((item) => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        item.englishCollocation.toLowerCase().includes(query) ||
        item.persianMeaning.toLowerCase().includes(query) ||
        item.importance.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === "all" || item.questionCategory === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [allCollocations, searchQuery, selectedCategory]);

  // --- Flashcard States ---
  const [fcStarted, setFcStarted] = useState(false);
  const [fcCurrentIndex, setFcCurrentIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcMode, setFcMode] = useState<"en-fa" | "fa-en" | "sentence">("en-fa");
  const [fcSessionList, setFcSessionList] = useState<FlattenedCollocation[]>([]);
  const [fcMasteredList, setFcMasteredList] = useState<string[]>([]); // holds Collocation strings

  // --- Quiz States ---
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCurrentIndex, setQuizCurrentIndex] = useState(0);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<
    Record<number, { selectedOption: string; isCorrect: boolean }>
  >({});
  const [quizSelectedOption, setQuizSelectedOption] = useState<string | null>(null);
  const [quizIsCompleted, setQuizIsCompleted] = useState(false);
  const [quizLimit, setQuizLimit] = useState<number>(5);
  const [quizTime, setQuizTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean audio on unmount
  useEffect(() => {
    return () => {
      stopSpeech();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Quiz Timer Effect
  useEffect(() => {
    if (quizStarted && !quizIsCompleted) {
      timerRef.current = setInterval(() => {
        setQuizTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [quizStarted, quizIsCompleted]);

  const handleTtsPlayback = async (text: string, id: string) => {
    // Toggle off if the same item is tapped again.
    if (ttsLoadingId === id) {
      stopSpeech();
      setTtsLoadingId(null);
      return;
    }
    setTtsLoadingId(id);
    await speak(text, () => setTtsLoadingId(null));
  };

  // --- BiDi Clean text formatting tool ---
  const formatTextWithBold = (text: string) => {
    if (!text) return "";
    
    // Split by markdown bold (**text**)
    const boldParts = text.split(/\*\*(.*?)\*\*/g);
    
    return boldParts.flatMap((part, index) => {
      const isBold = index % 2 === 1;
      
      // Match English/Latin words/phrases inside Persian sentences.
      const latinRegex = /((?:[\(\[\{0-9\+]*[a-zA-Z]+[a-zA-Z0-9\s\-/\+\(\)\[\]\{\}\.,;:'"%%’“”!?&\-\–\—\*\\]*[a-zA-Z0-9\)\]\}%\!\?\+]+|[\(\[\{0-9\+]*[a-zA-Z]+))/g;
      
      const subParts = part.split(latinRegex);
      return subParts.map((subPart, subIdx) => {
        const isLatin = subIdx % 2 === 1;
        
        if (isLatin) {
          return (
            <span
              key={`bold-${index}-sub-${subIdx}`}
              dir="ltr"
              className={`inline-block font-mono text-[13px] px-1 py-0.5 rounded tracking-wide border align-middle select-all mx-0.5 ${
                isBold
                  ? "bg-blue-50/90 dark:bg-blue-95/35 text-blue-750 dark:text-blue-300 border-blue-200/50 dark:border-blue-900/40 font-extrabold"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200/40 dark:border-slate-700/40 font-semibold"
              }`}
            >
              {subPart}
            </span>
          );
        } else {
          return isBold ? (
            <strong
              key={`bold-${index}-sub-${subIdx}`}
              className="font-bold text-amber-600 dark:text-amber-400 font-sans mx-0.5 inline"
            >
              {subPart}
            </strong>
          ) : (
            <span
              key={`bold-${index}-sub-${subIdx}`}
              className="font-sans font-semibold text-slate-800 dark:text-slate-200 inline"
            >
              {subPart}
            </span>
          );
        }
      });
    });
  };

  // --- Flashcard Session Controllers ---
  const startFlashcardSession = () => {
    if (filteredCollocations.length === 0) return;
    // Shuffle the list for active learning integration
    const shuffled = [...filteredCollocations].sort(() => 0.5 - Math.random());
    setFcSessionList(shuffled);
    setFcCurrentIndex(0);
    setFcFlipped(false);
    setFcMasteredList([]);
    setFcStarted(true);
  };

  const handleFlashcardCardAction = (mastered: boolean) => {
    const currentItem = fcSessionList[fcCurrentIndex];
    
    if (mastered) {
      setFcMasteredList((prev) => [...prev, currentItem.englishCollocation]);
    }

    setFcFlipped(false);
    
    // Quick timeout to let flip CSS reset smoothly
    setTimeout(() => {
      if (fcCurrentIndex < fcSessionList.length - 1) {
        setFcCurrentIndex((prev) => prev + 1);
      } else {
        // Handled completed
        setFcCurrentIndex(fcSessionList.length);
      }
    }, 155);
  };

  // --- Quiz Session Controllers ---
  const startQuizSession = (count: number) => {
    if (filteredCollocations.length < 2) return; // Need at least some options

    // Shuffle and slice current list
    const shuffledSource = [...filteredCollocations].sort(() => 0.5 - Math.random());
    const sliceCount = Math.min(count, shuffledSource.length);
    const selectedCollocations = shuffledSource.slice(0, sliceCount);

    const questionsList: QuizQuestion[] = selectedCollocations.map((col) => {
      // Determine quiz type (prefer sentence if example exists)
      const hasReqExample = !!col.example && col.example.trim().length > 10;
      const questionType = hasReqExample ? (Math.random() > 0.4 ? "sentence" : "meaning") : "meaning";

      // Pool distractor choices
      const potentialDistractors = allCollocations.filter(
        (c) => c.englishCollocation !== col.englishCollocation
      );
      
      const shuffledDistractors = potentialDistractors.sort(() => 0.5 - Math.random());
      const distractorsSet = new Set<string>();
      
      for (const d of shuffledDistractors) {
        if (distractorsSet.size >= 3) break;
        distractorsSet.add(d.englishCollocation);
      }

      // Safeguard: if not enough collocations, pad with dummy text or keep whatever is available
      const options = [col.englishCollocation, ...Array.from(distractorsSet)];
      
      // Shuffle options
      const randomizedOptions = options.sort(() => 0.5 - Math.random());

      return {
        collocation: col,
        type: questionType as "sentence" | "meaning",
        options: randomizedOptions,
        correctOption: col.englishCollocation,
      };
    });

    setQuizQuestions(questionsList);
    setQuizCurrentIndex(0);
    setQuizAnswers({});
    setQuizSelectedOption(null);
    setQuizIsCompleted(false);
    setQuizTime(0);
    setQuizStarted(true);
  };

  const handleSelectQuizOption = (option: string) => {
    if (quizSelectedOption !== null) return; // Block double clicks

    setQuizSelectedOption(option);
    const correctAns = quizQuestions[quizCurrentIndex].correctOption;
    const isCorrect = option === correctAns;

    setQuizAnswers((prev) => ({
      ...prev,
      [quizCurrentIndex]: {
        selectedOption: option,
        isCorrect,
      },
    }));
  };

  const advanceQuiz = () => {
    setQuizSelectedOption(null);
    if (quizCurrentIndex < quizQuestions.length - 1) {
      setQuizCurrentIndex((prev) => prev + 1);
    } else {
      setQuizIsCompleted(true);
    }
  };

  const getQuizScoreStats = () => {
    const total = quizQuestions.length;
    let correct = 0;
    quizQuestions.forEach((_, index) => {
      if (quizAnswers[index]?.isCorrect) {
        correct += 1;
      }
    });
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { total, correct, percentage };
  };

  // Clear tab counters in changes
  const handleTabChange = (tab: "database" | "flashcards" | "quiz") => {
    setActiveTab(tab);
    setFcStarted(false);
    setQuizStarted(false);
  };

  return (
    <div className="space-y-6 text-left animate-fadeIn">
      {/* Visual Header Panel */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-2.5 text-[10px] bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 font-extrabold uppercase rounded-full tracking-wider border border-indigo-200/20 flex items-center gap-1.5">
              <Sparkle className="w-3 h-3 text-indigo-505 animate-pulse" />
              <span>Collocations Practice Desk</span>
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 font-display">
            <Volume2 className="w-5 h-5 text-indigo-500" />
            <span>Academic Recall Workspace</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Review collocations, play memory flashcards or generate exam-style fill-in-the-blank quizzes.
          </p>
        </div>

        <button
          onClick={onClose}
          className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
        >
          ← Return to Dashboard
        </button>
      </div>

      {/* Modern Inner Navigation Tab Container */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl flex gap-1 w-full max-w-lg flex-1">
          <button
            onClick={() => handleTabChange("database")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "database"
                ? "bg-white dark:bg-slate-900 border-none text-indigo-650 dark:text-indigo-400 shadow-sm font-black"
                : "text-slate-650 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Database List</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 rounded-md font-bold">
              {filteredCollocations.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("flashcards")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "flashcards"
                ? "bg-white dark:bg-slate-900 border-none text-indigo-650 dark:text-indigo-400 shadow-sm font-black"
                : "text-slate-650 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Active Recall Cards</span>
          </button>

          <button
            onClick={() => handleTabChange("quiz")}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "quiz"
                ? "bg-white dark:bg-slate-900 border-none text-indigo-650 dark:text-indigo-400 shadow-sm font-black"
                : "text-slate-650 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Interactive Quiz</span>
          </button>
        </div>

        {activeTab === "database" && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-full text-xs font-extrabold transition-all duration-200 active:scale-95 shadow-[0_4px_12px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-1.5 cursor-pointer border-none"
          >
            <Plus className="w-4 h-4 text-emerald-50" strokeWidth={3} />
            <span>Add Custom Collocation</span>
          </button>
        )}
      </div>

      {/* --- Filter & Category Controllers (Shown when not in active session) --- */}
      {(!fcStarted && !quizStarted) && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search academic collocations, Persian meanings, or context..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 pl-10 pr-4 py-3 rounded-2xl focus:outline-none focus:border-indigo-550 shadow-xs text-left cursor-text"
            />
            <Search className="w-4 h-4 absolute left-3.5 top-4 text-slate-400 dark:text-slate-500" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer font-en"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5" id="collocationCategoryFilters">
            {(["all", "FIB-R", "FIB-RW", "RO", "MCQ"] as const).map((cat) => {
              const isActive = selectedCategory === cat;
              const niceNames: Record<string, string> = {
                all: "All Exams",
                "FIB-R": "FIB Reading",
                "FIB-RW": "FIB RW",
                RO: "Reorder",
                MCQ: "MCQ",
              };
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 min-h-[36px] rounded-full text-xs font-bold font-en border transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "bg-indigo-600 dark:bg-indigo-500 border-indigo-600 dark:border-indigo-500 text-white shadow-md shadow-indigo-600/20 scale-102"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  {niceNames[cat]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================== TAB 1: LIBRARY DATABASE ==================== */}
      {activeTab === "database" && (
        <>
          {filteredCollocations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
              {filteredCollocations.map((item, idx) => {
                const getCategoryTheme = (cat: string) => {
                  const c = cat ? cat.toUpperCase().trim() : "GLOBAL";
                  if (c.includes("RW")) {
                    return {
                      borderClass: "border-l-4 border-l-purple-500",
                      badgeBg: "bg-purple-100 dark:bg-purple-950/40 text-purple-705 dark:text-purple-300 border-purple-200/20",
                      cardBg: "bg-gradient-to-tr from-purple-50/15 via-white to-white dark:from-purple-950/10 dark:via-slate-900 dark:to-slate-900"
                    };
                  }
                  if (c.includes("RO")) {
                    return {
                      borderClass: "border-l-4 border-l-teal-500",
                      badgeBg: "bg-teal-100 dark:bg-teal-950/40 text-teal-705 dark:text-teal-300 border-teal-200/20",
                      cardBg: "bg-gradient-to-tr from-teal-50/15 via-white to-white dark:from-teal-950/10 dark:via-slate-900 dark:to-slate-900"
                    };
                  }
                  if (c.includes("FIB") || c.includes("READING") || c.includes("R")) {
                    return {
                      borderClass: "border-l-4 border-l-blue-500",
                      badgeBg: "bg-blue-105/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/20",
                      cardBg: "bg-gradient-to-tr from-blue-50/15 via-white to-white dark:from-blue-950/10 dark:via-slate-900 dark:to-slate-900"
                    };
                  }
                  return {
                    borderClass: "border-l-4 border-l-emerald-500",
                    badgeBg: "bg-emerald-105/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/20",
                    cardBg: "bg-gradient-to-tr from-emerald-50/15 via-white to-white dark:from-emerald-950/10 dark:via-slate-900 dark:to-slate-900"
                  };
                };

                const theme = getCategoryTheme(item.questionCategory || "");
                return (
                  <div
                    key={`${item.englishCollocation}-${idx}`}
                    className={`${theme.cardBg} ${theme.borderClass} rounded-[28px] border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col justify-between space-y-4 hover:border-indigo-400 dark:hover:border-indigo-850 hover:shadow-lg transition-all duration-300 relative group`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-955/30 text-amber-700 dark:text-amber-400 font-bold text-[9px] uppercase border border-amber-200/20">
                            Collocation Item {idx + 1}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold text-[9px] uppercase border ${theme.badgeBg}`}>
                            {item.questionCategory}
                          </span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-850 dark:text-white mt-1">
                          {item.englishCollocation}
                        </h3>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTtsPlayback(item.englishCollocation, `col-${idx}`)}
                          className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-500 hover:text-indigo-650 dark:text-slate-400 flex items-center justify-center transition-all cursor-pointer border border-slate-100 dark:border-slate-755"
                          title="Audio Speech Synthesis"
                        >
                          {ttsLoadingId === `col-${idx}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </button>

                      <button
                        onClick={() => onOpenQuestion(item.questionId)}
                        className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 text-slate-500 dark:text-slate-400 hover:text-blue-600 flex items-center justify-center transition-all cursor-pointer border border-slate-100 dark:border-slate-750"
                        title="Open source question details"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleRemoveCollocation(item)}
                        className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-400 dark:text-slate-500 hover:text-red-650 dark:hover:text-red-400 flex items-center justify-center transition-all cursor-pointer border border-slate-100 dark:border-slate-755"
                        title="Delete collocation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs mt-1">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/45 rounded-2xl border border-slate-150/60 dark:border-slate-850">
                      <span className="text-[9px] text-slate-400 block mb-1 uppercase tracking-wider font-bold">
                        Persian Meaning:
                      </span>
                      <p
                        dir="auto"
                        className="text-slate-905 dark:text-white font-sans text-sm leading-relaxed font-semibold text-start block cursor-text select-all"
                      >
                        {formatTextWithBold(item.persianMeaning)}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-950/45 rounded-2xl border border-slate-150/60 dark:border-slate-850">
                      <span className="text-[9px] text-indigo-505 block mb-1 uppercase tracking-wider font-bold">
                        PTE Importance:
                      </span>
                      <p
                        dir="auto"
                        className="text-slate-800 dark:text-slate-205 font-sans font-semibold leading-relaxed text-start block"
                      >
                        {formatTextWithBold(item.importance)}
                      </p>
                    </div>
                  </div>

                  {item.example && (
                    <div className="p-3.5 bg-indigo-500/5 dark:bg-slate-950/50 border border-slate-100/70 dark:border-slate-800 rounded-xl text-xs text-slate-700 dark:text-slate-350">
                      <span className="text-[9px] text-slate-400 block mb-1 uppercase font-bold tracking-wider">
                        Context Sentence:
                      </span>
                      {formatTextWithBold(item.example)}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 mt-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <BookOpen className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">Source: {item.questionTitle}</span>
                    </div>
                    <button
                      onClick={() => onOpenQuestion(item.questionId)}
                      className="text-indigo-650 group-hover:text-indigo-400 font-bold hover:underline transition-colors flex items-center gap-0.5 cursor-pointer bg-transparent border-none outline-none flex-shrink-0"
                    >
                      <span>Study Card</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto my-8">
              <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h4 className="text-base font-bold text-slate-800 dark:text-white mb-1">
                No Collocations Found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                {searchQuery
                  ? "Try resetting filters or adjusting search queries to locate your saved PTE collocations."
                  : "Analyze a PTE screenshot or upload a passage study card to index core collocations!"}
              </p>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategory("all");
                  }}
                  className="mt-4 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-all cursor-pointer border-none"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ==================== TAB 2: ACTIVE RECALL FLASHCARDS ==================== */}
      {activeTab === "flashcards" && (
        <div className="pb-12 max-w-2xl mx-auto">
          {!fcStarted ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xs text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Brain className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-805 dark:text-white font-display">
                  Active Recall Flashcards Desk
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                  Toggle dynamic study decks to test vocabulary patterns. Best used before tests with self-monitored repetition.
                </p>
              </div>

              {filteredCollocations.length > 0 ? (
                <>
                  {/* Setup configuration */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 max-w-md mx-auto space-y-4">
                    <div className="text-left">
                      <label className="text-[10px] font-bold text-slate-450 dark:text-slate-400 block mb-2 uppercase tracking-wide">
                        Decks Challenge Format:
                      </label>
                      <div className="grid grid-cols-1 gap-2.5">
                        <button
                          onClick={() => setFcMode("en-fa")}
                          className={`p-3 text-xs rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            fcMode === "en-fa"
                              ? "bg-white dark:bg-slate-900 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs"
                              : "bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900"
                          }`}
                        >
                          <div>
                            <span className="block text-xs">English → Persian translation</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Shows English collocation, guess Persian meaning.</span>
                          </div>
                          {fcMode === "en-fa" && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                        </button>

                        <button
                          onClick={() => setFcMode("fa-en")}
                          className={`p-3 text-xs rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            fcMode === "fa-en"
                              ? "bg-white dark:bg-slate-900 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs"
                              : "bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900"
                          }`}
                        >
                          <div>
                            <span className="block text-xs">Persian → English collocation</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Shows Persian key, recall English academic phrase.</span>
                          </div>
                          {fcMode === "fa-en" && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                        </button>

                        <button
                          onClick={() => setFcMode("sentence")}
                          className={`p-3 text-xs rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                            fcMode === "sentence"
                              ? "bg-white dark:bg-slate-900 border-indigo-500 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs"
                              : "bg-white/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900"
                          }`}
                        >
                          <div>
                            <span className="block text-xs">Sentence Fill-in-the-Blank ⚡</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">Extract example sentences with blank collocations!</span>
                          </div>
                          {fcMode === "sentence" && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                        </button>
                      </div>
                    </div>

                    <div className="text-left pt-2 border-t border-slate-200/50 dark:border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-500 text-[11px]">Active deck counts:</span>
                      <span className="font-bold text-slate-800 dark:text-white bg-slate-200 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                        {filteredCollocations.length} collocations
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={startFlashcardSession}
                    className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-2xl cursor-pointer shadow-md shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 mx-auto"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Active Recall Drill</span>
                  </button>
                </>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950/40 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 max-w-sm mx-auto">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    You have no collocations in this filter. Adjust exam categories in the top selection to load study decks.
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Active Flashcard Layout
            <div className="space-y-6">
              {/* Progress and indicators bar */}
              <div className="flex justify-between items-center text-xs bg-white dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-805">
                <div className="flex items-center gap-2">
                  <span className="text-slate-450 dark:text-slate-500">Studying:</span>
                  <span className="font-bold text-slate-700 dark:text-white">
                    {fcCurrentIndex + 1} of {fcSessionList.length}
                  </span>
                </div>

                <div className="h-2 w-32 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all duration-300"
                    style={{ width: `${((fcCurrentIndex) / fcSessionList.length) * 100}%` }}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-indigo-505 font-bold">
                    {fcMasteredList.length} mastered
                  </span>
                </div>
              </div>

              {fcCurrentIndex < fcSessionList.length ? (
                (() => {
                  const currentItem = fcSessionList[fcCurrentIndex];
                  
                  // Blank out collocation inside example text if sentence mode chosen
                  let frontHtmlText = "";
                  if (fcMode === "sentence") {
                    if (currentItem.example) {
                      const regex = new RegExp(currentItem.englishCollocation, "gi");
                      frontHtmlText = currentItem.example.replace(
                        regex,
                        " _________________ "
                      );
                    } else {
                      frontHtmlText = `(No example context added). Memorize: ${currentItem.englishCollocation}`;
                    }
                  }

                  return (
                    <div className="space-y-6">
                      {/* Standard Responsive Toggle Flip Area */}
                      <div
                        onClick={() => setFcFlipped(!fcFlipped)}
                        className={`min-h-[290px] bg-white dark:bg-slate-900 border-2 ${
                          fcFlipped
                            ? "border-emerald-300 dark:border-emerald-900/60 shadow-lg shadow-emerald-500/5"
                            : "border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-900"
                        } cursor-pointer rounded-[32px] p-8 flex flex-col justify-between transition-all duration-300 relative select-none`}
                      >
                        {/* Upper card header metadata */}
                        <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-100 dark:border-slate-800/80">
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                            {currentItem.questionCategory}
                          </span>

                          <span className="text-[10px] text-indigo-500 font-extrabold flex items-center gap-1 uppercase tracking-wider">
                            {fcFlipped ? "Revealed Answer ✓" : "Tap to Flip Card ⚡"}
                          </span>
                        </div>

                        {/* Centered Cue Segment */}
                        <div className="py-6 flex flex-col items-center justify-center text-center">
                          {!fcFlipped ? (
                            // FRONT OF CARD
                            <>
                              {fcMode === "en-fa" && (
                                <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white font-en tracking-wide">
                                  {currentItem.englishCollocation}
                                </h3>
                              )}

                              {fcMode === "fa-en" && (
                                <h3
                                  dir="auto"
                                  className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 font-sans leading-relaxed block"
                                >
                                  {currentItem.persianMeaning}
                                </h3>
                              )}

                              {fcMode === "sentence" && (
                                <p
                                  dir="auto"
                                  className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-200 font-sans leading-relaxed max-w-lg"
                                >
                                  {formatTextWithBold(frontHtmlText)}
                                </p>
                              )}

                              <div className="mt-6 flex justify-center">
                                <span className="text-[11px] bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-150/40 dark:border-slate-800/80 text-slate-400 hover:text-slate-600 dark:text-slate-550 flex items-center gap-1 shadow-2xs">
                                  <RotateCcw className="w-3 h-3 text-slate-400" />
                                  <span>Reveal bilingual translations</span>
                                </span>
                              </div>
                            </>
                          ) : (
                            // BACK OF CARD (Answer)
                            <div className="w-full text-left space-y-4">
                              <div className="text-center pb-2">
                                <span className="text-[10px] text-slate-400 block lowercase tracking-wide mb-1">Target Academic Phrase:</span>
                                <h3 className="text-xl font-black text-indigo-650 dark:text-indigo-400 inline-block font-en select-all">
                                  {currentItem.englishCollocation}
                                </h3>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-805">
                                  <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold block mb-1">Persian Meaning:</span>
                                  <p
                                    dir="auto"
                                    className="text-sm font-semibold text-slate-900 dark:text-white font-sans leading-relaxed text-start block"
                                  >
                                    {formatTextWithBold(currentItem.persianMeaning)}
                                  </p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-805">
                                  <span className="text-[9px] text-emerald-505 uppercase tracking-wider font-bold block mb-1">Importance Strategy:</span>
                                  <p
                                    dir="auto"
                                    className="text-xs font-semibold text-slate-800 dark:text-slate-250 font-sans leading-relaxed text-start block"
                                  >
                                    {formatTextWithBold(currentItem.importance)}
                                  </p>
                                </div>
                              </div>

                              {currentItem.example && (
                                <div className="p-3.5 bg-indigo-50/20 dark:bg-slate-950/40 rounded-xl text-xs text-slate-700 dark:text-slate-350 border border-slate-100 dark:border-slate-800/80">
                                  <span className="text-[9px] text-indigo-500 uppercase tracking-wider font-bold block mb-0.5">Example context:</span>
                                  {formatTextWithBold(currentItem.example)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Lower card footer block */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                          <span className="truncate max-w-[200px]">Category: {currentItem.questionTitle}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTtsPlayback(currentItem.englishCollocation, `col-fc-${fcCurrentIndex}`);
                            }}
                            className="text-indigo-655 hover:text-indigo-500 font-extrabold flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700"
                          >
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Listen Speech</span>
                          </button>
                        </div>
                      </div>

                      {/* Active Recall SRS User Evaluation Buttons */}
                      <div className="flex gap-4 max-w-md mx-auto justify-center">
                        <button
                          onClick={() => handleFlashcardCardAction(false)}
                          className="flex-1 py-3 px-4 rounded-xl border border-rose-200 hover:border-rose-405 bg-rose-50/40 dark:bg-rose-955/20 text-rose-705 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4 text-rose-500" />
                          <span>Need Practice (Again)</span>
                        </button>

                        <button
                          onClick={() => handleFlashcardCardAction(true)}
                          className="flex-1 py-3 px-4 rounded-xl border border-emerald-250/80 hover:border-emerald-450 bg-emerald-50/40 dark:bg-emerald-955/20 text-emerald-705 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-bold font-sans transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span>Know and Mastered</span>
                        </button>
                      </div>

                      {/* Back quit button */}
                      <div className="text-center">
                        <button
                          onClick={() => setFcStarted(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-transparent border-none"
                        >
                          Quit learning session
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Completed learning presentation screen
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-10 text-center space-y-6 max-w-md mx-auto">
                  <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-505 flex items-center justify-center mx-auto">
                    <Trophy className="w-8 h-8 animate-bounce text-amber-500" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white font-display">
                      Deck Learning Complete!
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      You reviewed all <span className="font-bold text-slate-800 dark:text-white">{fcSessionList.length} collocations</span>. Self-evaluation keeps your brain pathways active.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150/60 dark:border-slate-800/80 flex justify-between text-xs font-bold text-slate-700 dark:text-slate-350">
                    <span>Self-Rated Mastered:</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {fcMasteredList.length} of {fcSessionList.length} ({Math.round((fcMasteredList.length / fcSessionList.length) * 100)}%)
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={startFlashcardSession}
                      className="flex-1 py-3 text-xs bg-indigo-600 hover:bg-indigo-750 text-white font-bold rounded-xl transition-all cursor-pointer shadow-xs"
                    >
                      Drill Again
                    </button>
                    <button
                      onClick={() => setFcStarted(false)}
                      className="flex-1 py-3 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-705 dark:text-slate-300 font-bold rounded-xl transition-all cursor-pointer border border-slate-200/50 dark:border-slate-700"
                    >
                      Setup Panel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 3: INTERACTIVE QUIZ ==================== */}
      {activeTab === "quiz" && (
        <div className="pb-12 max-w-2xl mx-auto">
          {!quizStarted ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xs text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-650 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Award className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-850 dark:text-white font-display">
                  PTE Multiple-Choice Quiz Desk
                </h3>
                <p className="text-xs text-slate-505 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                  Programmatically build active practice tests using extracted collocations in your system. Evaluates context fill-in-the-blank skills and bilingual meaning associations in minutes.
                </p>
              </div>

              {filteredCollocations.length >= 2 ? (
                <>
                  <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-150 dark:border-slate-805 max-w-md mx-auto space-y-4">
                    <div className="text-left">
                      <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-2">
                        Configure Quiz Question Count:
                      </label>
                      <div className="flex gap-2">
                        {([5, 10, 15] as const).map((num) => (
                          <button
                            key={num}
                            onClick={() => setQuizLimit(num)}
                            className={`flex-1 py-2.5 text-xs rounded-xl font-bold transition-all cursor-pointer ${
                              quizLimit === num
                                ? "bg-indigo-600 text-white shadow-xs border-indigo-600"
                                : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850"
                            }`}
                          >
                            {num} Questions
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="text-left pt-2 border-t border-slate-200/40 dark:border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-505 dark:text-slate-400">Available pool matching filters:</span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg">
                        {filteredCollocations.length} collocations
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => startQuizSession(quizLimit)}
                    className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold rounded-2xl cursor-pointer shadow-md shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 mx-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                    <span>Generate Practice Exam</span>
                  </button>
                </>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950/40 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 max-w-sm mx-auto">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    You need to have at least 2 saved collocations matching the active filter to generate interactive practice quizzes. Analyze more reading screenshots to register collocations!
                  </p>
                </div>
              )}
            </div>
          ) : (
            // Quiz Question Arena
            <div className="space-y-6">
              {/* Quiz progress ribbon */}
              <div className="flex justify-between items-center text-xs bg-white dark:bg-slate-900 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 font-sans">
                  <span className="text-slate-400 font-bold block">PTE Drill:</span>
                  <span className="font-extrabold text-slate-700 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    {quizCurrentIndex + 1} of {quizQuestions.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-slate-500">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="font-mono text-xs font-semibold">
                    {Math.floor(quizTime / 60)}:{(quizTime % 60).toString().padStart(2, "0")}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-bold">
                  <span className="text-indigo-600 dark:text-indigo-400">
                    Progress: {Math.round(((quizCurrentIndex) / quizQuestions.length) * 100)}%
                  </span>
                </div>
              </div>

              {!quizIsCompleted ? (
                (() => {
                  const q = quizQuestions[quizCurrentIndex];
                  const hasUserAnswered = quizSelectedOption !== null;
                  const answeredInfo = quizAnswers[quizCurrentIndex];

                  // Construct question task displays
                  let questionPrompt = "";
                  let questionTargetField = "";

                  if (q.type === "sentence") {
                    questionPrompt = "Select the correct academic collocation that accurately fits the example context below:";
                    // Replace English collocation with highlighted gap
                    if (q.collocation.example) {
                      const regex = new RegExp(q.collocation.englishCollocation, "gi");
                      questionTargetField = q.collocation.example.replace(
                        regex,
                        " [ _________ ] "
                      );
                    } else {
                      questionTargetField = "Example sentence blanking error. Please recall: [ _________ ]";
                    }
                  } else {
                    questionPrompt = "Identify the English collocation that corresponds to the Persian translation displayed below:";
                    questionTargetField = q.collocation.persianMeaning;
                  }

                  return (
                    <div className="space-y-6">
                      {/* Interactive Prompt card */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between space-y-4">
                        <div className="flex items-center gap-2">
                          <span className="p-1 px-2 text-[8px] bg-amber-50 dark:bg-amber-955/35 text-amber-500 border border-amber-200/20 uppercase rounded-md font-bold">
                            Question {quizCurrentIndex + 1}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold">
                            Task Type: {q.type === "sentence" ? "Sentence Completion" : "Bilingual Association"}
                          </span>
                        </div>

                        <p className="text-xs font-semibold text-slate-505 dark:text-slate-405 leading-relaxed">
                          {questionPrompt}
                        </p>

                        <div className="p-6 bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-805 rounded-2xl text-center">
                          {q.type === "sentence" ? (
                            <p
                              dir="auto"
                              className="text-sm md:text-base font-medium text-slate-700 dark:text-slate-150 leading-relaxed font-sans max-w-xl mx-auto"
                            >
                              {formatTextWithBold(questionTargetField)}
                            </p>
                          ) : (
                            <h3
                              dir="auto"
                              className="text-lg md:text-xl font-bold text-slate-805 dark:text-white leading-relaxed font-sans block select-all cursor-text max-w-xl mx-auto"
                            >
                              {formatTextWithBold(questionTargetField)}
                            </h3>
                          )}
                        </div>
                      </div>

                      {/* Choice Options list */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {q.options.map((option, optIdx) => {
                          const isSelected = quizSelectedOption === option;
                          const isCorrectChoice = option === q.correctOption;

                          let optionStyle = "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-indigo-400 dark:hover:border-indigo-850";
                          let optionIcon = <HelpCircle className="w-4 h-4 text-slate-350 dark:text-slate-650" />;

                          if (hasUserAnswered) {
                            if (isCorrectChoice) {
                              // Always highlight the correct answer in Green
                              optionStyle = "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-955/20 text-emerald-805 dark:text-emerald-400 font-bold scale-102";
                              optionIcon = <Check className="w-4 h-4 text-emerald-505" />;
                            } else if (isSelected) {
                              // If they selected this one and it's incorrect, highlight in Red
                              optionStyle = "border-rose-400 bg-rose-50/50 dark:bg-rose-955/25 text-rose-705 dark:text-rose-400 font-bold";
                              optionIcon = <X className="w-4 h-4 text-rose-505" />;
                            } else {
                              // Other incorrect options fade out slightly
                              optionStyle = "border-slate-200/50 dark:border-slate-805/50 bg-white/50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 opacity-60";
                              optionIcon = null;
                            }
                          }

                          return (
                            <button
                              key={`opt-${optIdx}`}
                              onClick={() => handleSelectQuizOption(option)}
                              disabled={hasUserAnswered}
                              className={`p-4 rounded-2xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${optionStyle}`}
                            >
                              <span className="font-bold tracking-wide leading-normal font-en truncate max-w-[210px]">{option}</span>
                              {optionIcon && <span className="flex-shrink-0 ml-2">{optionIcon}</span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Immediate Feedback Explanation Block */}
                      {hasUserAnswered && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4 animate-slideUp">
                          <div className="flex items-center gap-2">
                            {answeredInfo.isCorrect ? (
                              <span className="flex items-center gap-1.5 text-xs text-emerald-650 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-full font-black">
                                <Check className="w-3.5 h-3.5" />
                                <span>Perfect Score! Correct</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs text-rose-650 dark:text-rose-400 bg-rose-100/50 dark:bg-rose-950/30 px-2.5 py-1 rounded-full font-black">
                                <X className="w-3.5 h-3.5" />
                                <span>Answer Practice Needed</span>
                              </span>
                            )}

                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              Translation Matrix Review
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-805 text-xs">
                              <span className="text-[9px] text-slate-400 uppercase tracking-wider block mb-0.5">Translation:</span>
                              <p
                                dir="auto"
                                className="font-semibold text-slate-900 dark:text-white font-sans text-start block"
                              >
                                {formatTextWithBold(q.collocation.persianMeaning)}
                              </p>
                            </div>

                            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-805 text-xs">
                              <span className="text-[9px] text-indigo-550 uppercase tracking-wider block mb-0.5">Key Grammar Tip:</span>
                              <p
                                dir="auto"
                                className="font-semibold text-slate-850 dark:text-slate-200 font-sans text-start block leading-relaxed"
                              >
                                {formatTextWithBold(q.collocation.importance)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-xs">
                            <button
                              onClick={() => handleTtsPlayback(q.correctOption, `q-tts-${quizCurrentIndex}`)}
                              className="text-indigo-655 hover:text-indigo-500 font-bold flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700"
                            >
                              <Play className="w-3 h-3 fill-current" />
                              <span>Listen Speech Playback</span>
                            </button>

                            <button
                              onClick={advanceQuiz}
                              className="px-5 py-2.5 bg-indigo-600 hover:bg-slate-800 text-white dark:hover:bg-slate-200 dark:hover:text-slate-900 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <span>
                                {quizCurrentIndex < quizQuestions.length - 1 ? "Next Drill Question →" : "View Quiz Results 🎉"}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Quit Button */}
                      <div className="text-center pt-2">
                        <button
                          onClick={() => setQuizStarted(false)}
                          className="text-xs text-slate-400 hover:text-slate-600 transition-all bg-transparent border-none cursor-pointer"
                        >
                          Quit active quiz session
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Completed Results Analytics Presentation
                (() => {
                  const stats = getQuizScoreStats();
                  const rating = stats.percentage;

                  let cardTitle = "Needs Intense Review";
                  let cardThemeColors = "text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/30";
                  
                  if (rating >= 80) {
                    cardTitle = "PTE Collocation Mastery!";
                    cardThemeColors = "text-amber-500 bg-amber-50 dark:bg-amber-955/30 border-amber-100 dark:border-amber-900/30";
                  } else if (rating >= 50) {
                    cardTitle = "Good Progress, Keep Active";
                    cardThemeColors = "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/30";
                  }

                  return (
                    <div className="space-y-6">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-808 rounded-3xl p-8 shadow-xs text-center space-y-6">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border ${cardThemeColors}`}>
                          <Trophy className="w-8 h-8" />
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-slate-850 dark:text-white font-display">
                            Practice Test Evaluated!
                          </h3>
                          <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                            Bilingual performance analysis has completed. Great work pushing your academic active recall limits.
                          </p>
                        </div>

                        {/* Large Score Metric */}
                        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-left border border-slate-150/50 dark:border-slate-805">
                          <div className="col-span-1 text-center border-r border-slate-200 dark:border-slate-800">
                            <span className="text-[9px] text-slate-400 block uppercase">Correct:</span>
                            <span className="text-lg font-black text-indigo-650 dark:text-indigo-400">{stats.correct}</span>
                          </div>
                          <div className="col-span-1 text-center border-r border-slate-200 dark:border-slate-800">
                            <span className="text-[9px] text-slate-400 block uppercase">Total Questions:</span>
                            <span className="text-lg font-black text-slate-600 dark:text-slate-300">{stats.total}</span>
                          </div>
                          <div className="col-span-1 text-center">
                            <span className="text-[9px] text-slate-400 block uppercase">Pass Rate:</span>
                            <span className={`text-lg font-black ${stats.percentage >= 80 ? 'text-emerald-500' : 'text-indigo-500'}`}>{stats.percentage}%</span>
                          </div>
                        </div>

                        <div className="flex gap-2 max-w-sm mx-auto">
                          <button
                            onClick={() => startQuizSession(quizLimit)}
                            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-xs border-none"
                          >
                            Retake Quiz
                          </button>
                          <button
                            onClick={() => setQuizStarted(false)}
                            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl cursor-pointer border border-slate-200 dark:border-slate-700"
                          >
                            Quiz Home Panel
                          </button>
                        </div>
                      </div>

                      {/* Detailed list display of answers */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs space-y-4">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                          Bilingual Answer Breakdown Sheet
                        </h4>
                        <div className="space-y-4 text-xs font-sans">
                          {quizQuestions.map((qItem, qIdx) => {
                            const ansInfo = quizAnswers[qIdx] || { selectedOption: "None", isCorrect: false };
                            return (
                              <div
                                key={`review-${qIdx}`}
                                className="pb-4 border-b border-slate-100 dark:border-slate-800 last:border-none last:pb-0 flex flex-col gap-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-slate-700 dark:text-slate-300">
                                    Question {qIdx + 1}: {qItem.collocation.englishCollocation}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    ansInfo.isCorrect
                                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                                      : "bg-rose-50 text-rose-600 dark:bg-rose-955/20"
                                  }`}>
                                    {ansInfo.isCorrect ? "Correct ✓" : "Incorrect ✗"}
                                  </span>
                                </div>
                                <div className="text-[11px] grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-500">
                                  <span>Your response: <strong className="text-slate-700 dark:text-slate-300">{ansInfo.selectedOption}</strong></span>
                                  <span>Persian translation: <strong className="font-sans font-semibold text-slate-800 dark:text-slate-200">{qItem.collocation.persianMeaning}</strong></span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          ADD CUSTOM MANUALLY CREATED COLLOCATION MODAL WITH HIGH PRECISION LUXURY DESIGN 
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-xl bg-white dark:bg-[#0c1224] rounded-[28px] border border-slate-200/80 dark:border-white/[0.05] shadow-2xl p-6 overflow-hidden md:p-8 animate-slide-up">
            
            {/* Header section with decorative gradients */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-indigo-500 to-teal-500"></div>

            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/[0.04]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white font-display">
                    Record Custom Collocation
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Manually inject expert academic collocations directly into study tools.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-transparent border-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Discard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error notifications */}
            {addError && (
              <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-955/20 border border-rose-200/30 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-xl flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse flex-shrink-0"></div>
                <span>{addError}</span>
              </div>
            )}

            {/* Form Section */}
            <form onSubmit={handleAddCollocation} className="mt-6 space-y-5">
              
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {/* English Collocation input */}
                <div className="space-y-1 text-left">
                  <label className="text-xs font-semibold text-slate-400 block">
                    English Collocation <span className="text-emerald-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., compile a report, deeply rooted"
                    value={newEnglishCollocation}
                    onChange={(e) => setNewEnglishCollocation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0f172d] border border-slate-200/80 dark:border-white/[0.05] rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {/* Persian Translation input (RTL) */}
                <div className="space-y-1 text-left">
                  <label className="text-xs font-semibold text-slate-400 block">
                    Persian Translation <span className="text-emerald-500 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    dir="rtl"
                    placeholder="مانند: تهیه گزارش، عمیقاً ریشه‌دار"
                    value={newPersianMeaning}
                    onChange={(e) => setNewPersianMeaning(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#0f172d] border border-slate-200/80 dark:border-white/[0.05] rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 text-right transition-colors font-sans"
                  />
                </div>
              </div>

              {/* PTE High Priority Importance Description */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-400 block">
                  PTE Importance & Style Guide
                </label>
                <input
                  type="text"
                  placeholder="e.g., Highly frequent in academic reading passages"
                  value={newImportance}
                  onChange={(e) => setNewImportance(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0f172d] border border-slate-200/80 dark:border-white/[0.05] rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Context Sentence Example (Optional) */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-400 block">
                  Example Context (Optional)
                </label>
                <textarea
                  placeholder="Write a clear sentence including the collocation..."
                  value={newExample}
                  onChange={(e) => setNewExample(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-[#0f172d] border border-slate-200/80 dark:border-white/[0.05] rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              {/* Associate to specific reading slide or keep global custom database */}
              <div className="space-y-1 text-left">
                <label className="text-xs font-semibold text-slate-400 block">
                  Associated Module / Deck Location
                </label>
                <select
                  value={associatedQuestionId}
                  onChange={(e) => setAssociatedQuestionId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#0f172d] border border-slate-200/80 dark:border-white/[0.05] rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                >
                  <option value="global">✦ Global Custom Decks (Default)</option>
                  {questions
                    .filter((q) => q.id !== "manual-collocations")
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        📚 [{q.category}] {q.title || "Untitled Study Card"}
                      </option>
                    ))}
                </select>
              </div>

              {/* Bottom control handles with loading state */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.05] text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer bg-transparent transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCollocation}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10 border-none transition-colors"
                >
                  {isSubmittingCollocation ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Register Collocation</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React from "react";
import { SavedQuestion, QuestionCategory } from "../types";
import {
  GraduationCap,
  Sun,
  Moon,
  PlusCircle,
  Search,
  FolderOpen,
  Pencil,
  ChevronLeft,
  ChevronRight,
  BookMarked,
  Trash2,
  Star,
  FileText,
} from "lucide-react";

interface SidebarProps {
  questions: SavedQuestion[];
  selectedQuestionId: string | null;
  activeFilter: string;
  searchQuery: string;
  isDarkMode: boolean;
  totalCollocations: number;
  onSelectQuestion: (id: string) => void;
  onFilterChange: (filter: string) => void;
  onSearchChange: (query: string) => void;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onNewUploadTrigger: () => void;
  onToggleCollocationsReview: () => void;
  onDeleteQuestion: (id: string) => void;
  onToggleStar: (id: string) => void;
  onToggleTextStudy: () => void;
  isTextStudyActive: boolean;
}

export default function Sidebar({
  questions,
  selectedQuestionId,
  activeFilter,
  searchQuery,
  isDarkMode,
  totalCollocations,
  onSelectQuestion,
  onFilterChange,
  onSearchChange,
  onToggleTheme,
  onGoHome,
  onNewUploadTrigger,
  onToggleCollocationsReview,
  onDeleteQuestion,
  onToggleStar,
  onToggleTextStudy,
  isTextStudyActive,
}: SidebarProps) {
  // Filter questions based on category filter and search term
  const filteredQuestions = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return questions.filter((item) => {
      if (activeFilter === "starred") {
        if (!item.isStarred) return false;
      } else if (activeFilter !== "all" && item.category !== activeFilter) {
        return false;
      }
      if (q) {
        const titleMatch = item.title?.toLowerCase().includes(q);
        const noteMatch = item.note?.toLowerCase().includes(q);
        // Searching rawResponse is heavy, but memoizing the search helps prevent redundant executions
        const resMatch = item.rawResponse?.toLowerCase().includes(q);
        return titleMatch || noteMatch || resMatch;
      }
      return true;
    });
  }, [questions, activeFilter, searchQuery]);

  // Helper to resolve title dynamically when saved title is generic or repetitive
  const getDisplayTitle = (item: SavedQuestion) => {
    const isGeneric = !item.title || 
      item.title === "Fill in the Blanks (Reading)" || 
      item.title === "Fill in the Blanks (Reading & Writing)" || 
      item.title === "Reorder Paragraphs" || 
      item.title === "Multiple Choice" ||
      item.title.startsWith("Question type:");
    
    if (isGeneric && item.rawResponse) {
      try {
        const parsed = JSON.parse(item.rawResponse);
        if (parsed.passageTitle) {
          return parsed.passageTitle;
        }
        if (parsed.fullPassageTranslation) {
          const englishPart = parsed.fullPassageTranslation.split("\n\n")[0];
          const cleanText = englishPart.replace(/[^\w\s-]/g, ' ');
          const words = cleanText.split(/\s+/).filter(Boolean).slice(0, 5);
          if (words.length > 0) {
            return words.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
          }
        }
      } catch {
        // Fallback
      }
    }
    return item.title || "Reading Analysis";
  };

  return (
    <aside
      id="sidebar"
      className="w-full md:w-80 bg-white dark:bg-[#0b1121] text-slate-800 dark:text-slate-100 flex-shrink-0 flex flex-col border-r border-slate-200/80 dark:border-white/[0.05] transition-colors duration-200 overflow-hidden relative z-20"
    >
      <div className="p-6 border-b border-slate-200/80 dark:border-white/[0.05] flex items-center justify-between gap-2">
        <button
          onClick={onGoHome}
          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group bg-transparent border-none outline-none p-0 focus:outline-none"
          title="Return to Home"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30 flex-shrink-0 relative z-10 group-hover:scale-105 transition-transform">
            <BookMarked className="text-white w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-slate-900 dark:text-white font-en truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors w-full">
              PTE Core
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate w-full">
              Academic & General Reading Coach
            </p>
          </div>
        </button>

        <button
          onClick={onToggleTheme}
          className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:hover:text-white transition-all dark:text-slate-400 flex-shrink-0 relative z-10"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-405" />
          ) : (
            <Moon className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </div>

      {/* Stats Bar */}
      <div className="p-4 grid grid-cols-2 gap-2 bg-slate-50/50 dark:bg-[#080d1a]/60 border-b border-slate-200/60 dark:border-white/[0.04]">
        <div
          onClick={onGoHome}
          className="bg-white dark:bg-[#121a30] p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.05] text-center shadow-xs cursor-pointer hover:border-slate-350 dark:hover:border-indigo-500/30 transition-all duration-200 active:scale-98"
          title="Show home dashboard"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">Total Studies</span>
          <span className="text-xl font-black text-slate-800 dark:text-white">
            {questions.length}
          </span>
        </div>
        <div
          onClick={onToggleCollocationsReview}
          className="bg-white dark:bg-[#121a30] p-3 rounded-xl border border-indigo-100 dark:border-indigo-950/60 text-indigo-750 dark:text-indigo-400 text-center shadow-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-indigo-950/20 hover:border-indigo-400 dark:hover:border-indigo-500/40 transition-all duration-200 active:scale-98"
          title="Review all extracted collocations together"
        >
          <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block mb-1">Collocations</span>
          <span className="text-xl font-black text-indigo-650 dark:text-indigo-400">
            {totalCollocations}
          </span>
        </div>
      </div>

      {/* Category Filter / Add New Button */}
      <div className="p-4 flex flex-col gap-2">
        <button
          onClick={onNewUploadTrigger}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-600/20 active:scale-95 transition-all text-sm shadow relative z-10 cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Upload Screenshot</span>
        </button>
        <button
          onClick={onToggleTextStudy}
          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all text-sm shadow border relative z-10 cursor-pointer ${
            isTextStudyActive
              ? "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-lg shadow-indigo-500/15"
              : "bg-white dark:bg-[#1E293B] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/80"
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-500" />
          <span>Study Copied Text</span>
        </button>
      </div>

      {/* History Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-6 py-2 text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
          <span>Analysis History</span>
          <span className="bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[10px] text-blue-700 dark:text-blue-100 font-bold">
            {filteredQuestions.length}
          </span>
        </div>

        <div className="p-4 relative z-10 space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800/80 text-xs text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:border-blue-600 transition-all text-left"
            />
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          </div>

          {/* Categories filters */}
          <div className="flex flex-wrap gap-1" id="categoryFilterContainer">
            {(["all", "starred", "FIB-R", "FIB-RW", "RO", "MCQ", "TXT"] as const).map((cat) => {
              const isActive = activeFilter === cat;
              const niceNameMap: { [key: string]: string } = {
                all: "All",
                starred: "Starred ⭐",
                "FIB-R": "FIB Reading",
                "FIB-RW": "FIB RW",
                RO: "Reorder",
                MCQ: "MCQ",
                TXT: "Text Study 📝",
              };
              return (
                <button
                  key={cat}
                  onClick={() => onFilterChange(cat)}
                  className={`px-2 py-1 rounded text-[10px] transition-all font-bold cursor-pointer ${
                    isActive
                      ? "bg-slate-800 text-slate-100 dark:bg-slate-200 dark:text-slate-800"
                      : "bg-slate-100 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {niceNameMap[cat]}
                </button>
              );
            })}
          </div>
        </div>

        {/* History List */}
        <div id="historyList" className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 relative z-10">
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-xs">
              <FolderOpen className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-700 block" />
              No results found.
            </div>
          ) : (
            filteredQuestions.map((item) => {
              const isActive = selectedQuestionId === item.id;
              const cardClass = isActive
                ? "bg-gradient-to-tr from-blue-50 to-indigo-50/70 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-500 dark:border-blue-500/50 text-slate-900 dark:text-white shadow-xs border"
                : "bg-white dark:bg-[#121a30]/40 border-slate-205/60 dark:border-white/[0.04] text-slate-703 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#121a30]/80 hover:border-slate-300 dark:hover:border-white/[0.08] border shadow-2xs";

              let statusLabel = "Review";
              let statusClass = "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400";
              if (item.status === "mastered") {
                statusLabel = "Mastered";
                statusClass = "bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400";
              } else if (item.status === "critical") {
                statusLabel = "Critical";
                statusClass = "bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400";
              }

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectQuestion(item.id)}
                  className={`p-4 rounded-xl border ${cardClass} cursor-pointer transition-all duration-200 flex flex-col gap-2 group min-w-0`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900/60 text-blue-600 dark:text-blue-400 text-[9px] font-bold uppercase flex-shrink-0">
                        {item.category}
                      </span>
                      {item.isStarred && (
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                      )}
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate">
                        {item.date}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(item.id);
                        }}
                        className={`p-1 -m-1 rounded-md transition-all cursor-pointer border-none bg-transparent ${item.isStarred ? 'text-amber-500 hover:text-amber-600 opacity-100' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600 opacity-0 group-hover:opacity-100'}`}
                        title={item.isStarred ? "Unstar" : "Star this study card"}
                      >
                        <Star className="w-3 h-3" fill={item.isStarred ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteQuestion(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 -m-1 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-450 transition-all cursor-pointer border-none bg-transparent"
                        title="Delete study card from history"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <h5
                    className="text-xs font-bold leading-relaxed text-left truncate text-slate-900 dark:text-slate-150"
                    title={getDisplayTitle(item)}
                  >
                    {getDisplayTitle(item)}
                  </h5>
                  {item.note && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 text-left line-clamp-1 leading-normal bg-slate-50 dark:bg-slate-950/30 p-1.5 rounded border border-slate-100 dark:border-slate-800/40">
                      <Pencil className="w-2 h-2 text-slate-400 dark:text-slate-505 inline mr-1" />
                      {item.note}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${statusClass}`}>
                      {statusLabel}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-0.5">
                      Details <ChevronRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 text-center text-[10px] text-slate-400 bg-slate-50 dark:bg-slate-950/20 font-semibold">
        PTE Core Reading Coach © 2026
      </div>
    </aside>
  );
}

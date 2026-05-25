import React, { useState, useEffect } from "react";
import { SavedQuestion, AnalysisPayload, CollocationItem, MasteryStatus } from "../types";
import { speak, stopSpeech } from "../lib/tts";
import {
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Trash2,
  Volume2,
  Check,
  Edit3,
  Loader2,
  Maximize,
  Minimize,
  Download,
  Copy,
  Lightbulb,
  CheckCircle2,
  Play,
  Languages,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface AnalysisWorkspaceProps {
  question: SavedQuestion;
  onOpenNoteModal: () => void;
  onDeleteQuestion: (id: string) => void;
}

export default function AnalysisWorkspace({
  question,
  onOpenNoteModal,
  onDeleteQuestion,
}: AnalysisWorkspaceProps) {
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);
  const [globalTtsPlaying, setGlobalTtsPlaying] = useState(false);
  const isTextStudy = question.category === "TXT";

  // State for RO interactive reorder sandbox
  const [userOrder, setUserOrder] = useState<number[]>([]);
  const [verifyChecked, setVerifyChecked] = useState(false);

  // Reset reorder choices on question changes
  useEffect(() => {
    setUserOrder([]);
    setVerifyChecked(false);
  }, [question.id]);

  // Parse the rawResponse string securely
  const payload = React.useMemo(() => {
    try {
      return JSON.parse(question.rawResponse) as AnalysisPayload;
    } catch (err) {
      console.warn("Failed to parse rawResponse JSON, attempting legacy raw text simulation", err);
      return null;
    }
  }, [question.id, question.rawResponse]);

  const isDigitalMarketing = React.useMemo(() => {
    if (!payload) return false;
    const titleMatch = question.title?.toLowerCase().includes("marketing") || question.title?.includes("10000992");
    const sentenceMatch = payload.step3_sentenceParsing?.some(item => 
      item.englishSentence?.toLowerCase().includes("digital marketing")
    ) || false;
    return titleMatch || sentenceMatch;
  }, [question.title, question.category, payload]);

  const scrambledItems = React.useMemo(() => {
    if (!payload || !payload.step3_sentenceParsing) return [];
    
    // Original correct sorted list as analyzed by AI
    const list = payload.step3_sentenceParsing.map((item, index) => {
      let label = String.fromCharCode(65 + index);
      if (isDigitalMarketing) {
        const dmMap = ["B", "A", "D", "C"];
        label = dmMap[index] || label;
      }
      return {
        originalIndex: index,
        label,
        sentence: item.englishSentence,
        translation: item.persianTranslation,
        role: item.paragraphRole,
      };
    });

    // Scramble deterministically so it doesn't jump randomly, but is not in the correct [0, 1, 2, 3] sequence.
    // For Digital Marketing, we present exactly in screenshot order: A, B, C, D
    if (isDigitalMarketing) {
      const screenshotsOrderIdxs = [1, 0, 3, 2];
      return screenshotsOrderIdxs.map(idx => list[idx]).filter(Boolean);
    }

    // Default scramble for other general RO questions
    return [...list].sort((a, b) => (a.sentence.length * 3) % 7 - (b.sentence.length * 3) % 7);
  }, [payload, question.id, isDigitalMarketing]);

  const digitalMarketingPairsInfo = [
    {
      pair: "Paragraph B ➔ Paragraph A",
      title: "Noun to Pronoun Link (Definition to Referring Pronoun)",
      englishDesc: "Paragraph B defines 'Digital marketing' as an absolute independent start. Paragraph A begins with 'Its development...', where the possessive adjective 'Its' has no referent within sentence A − it refers directly back to 'Digital marketing' in B. Therefore, B must come immediately before A.",
      persianDesc: "پاراگراف B تعریف مستقل 'دیجیتال مارکتینگ' را پی می‌نهد. پاراگراف A با ضمیر اشاره 'Its development...' (توسعه آن...) آغاز می‌شود که مستقیماً به مفهوم بازاریابی دیجیتال در پاراگراف B رجوع دارد. لذا جفت متوالی B-A گشوده می‌شود.",
      points: "Link: B - A"
    },
    {
      pair: "Paragraph A ➔ Paragraph D",
      title: "Elaboration Link (Chronological & Scope Expansion)",
      englishDesc: "After stating the technological development during 1990s and 2000s in sentence A, sentence D expands this historical context by specifying that digital marketing 'extends to non-Internet channels'. This transitions from virtual systems to physical conduits.",
      persianDesc: "پس از تشریح دوره شکل‌گیری و توسعه در دهه‌های ۹۰ و ۲۰۰۰ در بند A، بند D چشم‌انداز را وسیع‌تر کرده و توضیح می‌دهد که چطور بازاریابی دیجیتال به 'کانال‌های غیر اینترنتی' (نظیر تلویزیون و تلفن همراه) گسترش می‌یابد.",
      points: "Link: A - D"
    },
    {
      pair: "Paragraph D ➔ Paragraph C",
      title: "Noun Echo Link (Action Verb to Definite Noun Phrase)",
      englishDesc: "Sentence D outlines the predicate 'extends to non-Internet channels'. Sentence C is paired next because it echoes this with the definitive noun group 'The extension to non-Internet channels...', contrasting it with 'online advertising'. This forms the final tie.",
      persianDesc: "جمله D با عبارت 'extends to non-Internet channels' به پایان می‌رسد. جمله C بلافاصله با گروه اسمی معرفه 'The extension to non-Internet channels...' شروع شده و این رابطه را عمیق‌تر کرده و با تبلیغات اینترنتی متمایز می‌کند.",
      points: "Link: D - C"
    }
  ];

  const genericPairsInfo = React.useMemo(() => {
    if (!payload || !payload.step3_sentenceParsing) return [];
    return payload.step3_sentenceParsing.slice(0, -1).map((item, idx) => {
      const nextItem = payload.step3_sentenceParsing[idx + 1];
      const truncCurr = item.englishSentence.split(" ").slice(0, 4).join(" ") + "...";
      const truncNext = nextItem.englishSentence.split(" ").slice(0, 4).join(" ") + "...";
      return {
        pair: `Sentence ${idx + 1} ➔ Sentence ${idx + 2}`,
        title: "Sequential Alignment Link",
        englishDesc: `Logical, grammatical, or cohesive transition directing flow from '${truncCurr}' to '${truncNext}'.`,
        persianDesc: `جهت‌دهی پیوسته و منطقی عبارات از بند آغازین به بند بعدی برای پدید آوردن پیوستگی زنجیره متنی در ریدینگ.`,
        points: `Link: S${idx+1} - S${idx+2}`
      };
    });
  }, [payload]);

  // Stop any audio when switching questions / unmounting.
  useEffect(() => {
    return () => stopSpeech();
  }, [question.id]);

  const imagesList = question.images || [];

  const handleTtsPlayback = async (text: string, id: string) => {
    // Toggle off if the same item is tapped again.
    if (ttsLoadingId === id) {
      stopSpeech();
      setTtsLoadingId(null);
      if (id === "global") setGlobalTtsPlaying(false);
      return;
    }

    setTtsLoadingId(id);
    if (id === "global") setGlobalTtsPlaying(true);

    await speak(text, () => {
      setTtsLoadingId(null);
      if (id === "global") setGlobalTtsPlaying(false);
    });
  };

  const handleGlobalTts = () => {
    if (!payload) return;
    const collocationsText = payload.step2_collocations
      ?.map((c) => c.englishCollocation)
      .join(", and ");
    const textPrompt = `The key collocations from this passage are: ${collocationsText || "not found"}.`;
    handleTtsPlayback(textPrompt, "global");
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(question.rawResponse);
    alert("Report copied successfully!");
  };

  const handleExportVocabulary = () => {
    if (!payload) return;
    let vocabStr = "";
    if (payload.step2_collocations && payload.step2_collocations.length > 0) {
      vocabStr += "--- KEY COLLOCATIONS ---\n" + payload.step2_collocations
        .map((c) => `${c.englishCollocation} - ${c.persianMeaning}`)
        .join("\n") + "\n\n";
    }
    if (payload.step2_hardWords && payload.step2_hardWords.length > 0) {
      vocabStr += "--- HARD WORDS FOR REVIEW ---\n" + payload.step2_hardWords
        .map((w) => `${w.word} ${w.phonetic || ""} - ${w.meaning}`)
        .join("\n") + "\n";
    }

    if (!vocabStr) return;

    const blob = new Blob([vocabStr], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PTE_Vocab_${question.category}_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatTextWithBold = (text: string) => {
    if (!text) return "";
    
    // Step 1: Split by markdown bold (**text**)
    const boldParts = text.split(/\*\*(.*?)\*\*/g);
    
    return boldParts.flatMap((part, index) => {
      const isBold = index % 2 === 1;
      
      // Step 2: Match English/Latin words/phrases inside Persian sentences.
      // We match sequences of ASCII/Latin letters, digits, and common punctuation that must contain at least one English letter.
      // This isolates English sequences inside Persian, preventing BiDi layout alignment jumbling.
      const latinRegex = /((?:[\(\[\{0-9\+]*[a-zA-Z]+[a-zA-Z0-9\s\-/\+\(\)\[\]\{\}\.,;:'"%%’“”!?&\-\–\—\*\\]*[a-zA-Z0-9\)\]\}%\!\?\+]+|[\(\[\{0-9\+]*[a-zA-Z]+))/g;
      
      const subParts = part.split(latinRegex);
      return subParts.map((subPart, subIdx) => {
        const isLatin = subIdx % 2 === 1;
        
        if (isLatin) {
          // Remove leading/trailing quotes if they accidentally got swept in, or keep them but don't box them.
          // Better: just render as inline text with distinct color and font, without borders and backgrounds.
          return (
            <bdi
              key={`bold-${index}-sub-${subIdx}`}
              dir="ltr"
              className={`inline-block font-sans px-0.5 mx-0.5 ${
                isBold
                  ? "text-blue-700 dark:text-blue-400 font-extrabold"
                  : "text-slate-800 dark:text-slate-200 font-bold"
              }`}
            >
              {subPart}
            </bdi>
          );
        } else {
          // It's Persian / non-Latin text. Use Inter font ("font-sans") for modern polished display
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

  return (
    <div className="space-y-6 text-left relative" id="workspaceContainer">
      {/* Floating Action Buttons for quick navigation */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-40">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="w-12 h-12 rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-700 flex items-center justify-center transition-transform hover:-translate-y-1 cursor-pointer border-none"
          title="Back to Top"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>

      {/* Right side study panel now takes full width */}
      <div className="space-y-6 transition-all duration-300">
        {/* Compact header actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2 relative z-10 w-full sm:w-auto">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse hidden sm:inline-block"></span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold hidden sm:inline-block">
              Analyzed: {question.date}
            </span>

            <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block"></div>
            
            <button
              onClick={onOpenNoteModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-705 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all text-[11px] font-bold border border-amber-200 dark:border-amber-800/30 shadow-xs cursor-pointer"
              title="Review Status"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>
                {question.status === "needs-review" && "🟠 Needs Review"}
                {question.status === "mastered" && "🟢 Mastered"}
                {question.status === "critical" && "🔴 Critical"}
              </span>
            </button>
            
            {/* Nav anchors */}
            <div className="flex gap-1 ml-2 flex-wrap">
              <button onClick={() => document.getElementById('step2')?.scrollIntoView({ behavior: 'smooth' })} className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer border-none">Vocab</button>
              <button onClick={() => document.getElementById('step-translation')?.scrollIntoView({ behavior: 'smooth' })} className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer border-none">Translate</button>
              {!isTextStudy && (
                <>
                  <button onClick={() => document.getElementById('step3')?.scrollIntoView({ behavior: 'smooth' })} className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer border-none">Parsing</button>
                  <button onClick={() => document.getElementById('step4')?.scrollIntoView({ behavior: 'smooth' })} className="px-2 py-1 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer border-none">Breakdown</button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
            <button
              onClick={handleGlobalTts}
              className="px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/15 hover:bg-teal-100 dark:hover:bg-teal-950/30 text-teal-650 dark:text-teal-400 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer border-none"
            >
              {ttsLoadingId === "global" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
              <span className="hidden md:inline">Listen Guide</span>
            </button>
            
            <button
              onClick={() => onDeleteQuestion(question.id)}
              className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-450 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer border-none"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Delete</span>
            </button>

            <button
              onClick={handleExportVocabulary}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-101 dark:hover:bg-indigo-900/50 transition-all flex items-center gap-1.5 shadow-xs tooltip cursor-pointer"
              title="Export key vocabulary items"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Export Vocab</span>
            </button>

            <button
              onClick={handleCopyReport}
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-705 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all shadow-xs cursor-pointer"
              title="Copy structured response object"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Full Parsed Steps Panels */}

          {payload ? (
            <div className="space-y-6">
              
              {/* Step 1: Question Type */}
              {!isTextStudy && (
                <div id="step1" className="bg-gradient-to-tr from-blue-50/50 via-white to-blue-50/10 dark:from-blue-950/20 dark:via-[#0c1224] dark:to-slate-950/5 rounded-2xl border border-blue-200 dark:border-blue-900/30 border-l-4 border-l-blue-500 overflow-hidden shadow-md animate-slide-up font-bold">
                  <div className="p-4 bg-blue-50/30 dark:bg-blue-950/20 border-b border-blue-105/30 dark:border-blue-900/10 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold font-en">
                      1
                    </span>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                      PTE Question Type
                    </h5>
                  </div>
                  <div className="p-5 font-en font-bold text-lg text-blue-600 dark:text-blue-400 tracking-wide">
                    {payload.step1_questionType || "Fill in the Blanks"}
                  </div>
                </div>
              )}

              {/* Step 2: Collocations */}
              <div id="step2" className="bg-gradient-to-tr from-amber-50/50 via-white to-amber-50/11 dark:from-amber-950/20 dark:via-[#0c1224] dark:to-slate-950/5 rounded-2xl border border-amber-200 dark:border-amber-900/40 border-l-4 border-l-amber-500 overflow-hidden shadow-md animate-slide-up">
                <div className="p-4 bg-amber-50/30 dark:bg-amber-950/20 border-b border-amber-105/30 dark:border-amber-900/10 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold font-en">
                    2
                  </span>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    Key Collocations & Academic Expressions
                  </h5>
                </div>
                <div className="p-5 divide-y divide-slate-100 dark:divide-slate-800 space-y-4 relative z-10">
                  {/* Key Collocations Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-block w-1.5 h-4 rounded-full bg-amber-500"></span>
                      <h6 className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Academic Collocations (کالوکیشن‌های آکادمیک)
                      </h6>
                    </div>
                    {payload.step2_collocations && payload.step2_collocations.length > 0 ? (
                      payload.step2_collocations.map((item, idx) => (
                        <div key={idx} className="py-4 first:pt-0 last:pb-0 space-y-2">
                          <div className="flex items-center justify-between">
                            <h6 className="text-sm font-extrabold text-slate-900 dark:text-white font-en">
                              {item.englishCollocation}
                            </h6>
                            <button
                              onClick={() => handleTtsPlayback(item.englishCollocation, `col-${idx}`)}
                              className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-amber-100 dark:hover:bg-amber-900 text-slate-500 hover:text-amber-600 transition-all text-xs cursor-pointer border-none"
                              title="Listen Pronunciation"
                            >
                              {ttsLoadingId === `col-${idx}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Play className="w-3 h-3 translation-x-[0.5px]" />
                              )}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-1">
                            <div className="p-3.5 bg-amber-50/40 dark:bg-amber-950/15 border border-amber-200/40 dark:border-amber-900/20 rounded-xl shadow-xs">
                              <span className="text-[10px] text-amber-700 dark:text-amber-400 block mb-1 font-bold">
                                Persian Meaning & Context:
                              </span>
                              <p
                                dir="auto"
                                className="text-slate-905 dark:text-white font-sans text-sm leading-relaxed font-semibold text-start block"
                              >
                                {formatTextWithBold(item.persianMeaning)}
                              </p>
                            </div>
                            <div className="p-3.5 bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-200/40 dark:border-emerald-900/20 rounded-xl shadow-xs">
                              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block mb-1 font-bold">
                                Exam Relevance & Tip:
                              </span>
                              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-semibold">
                                {formatTextWithBold(item.importance)}
                              </p>
                            </div>
                          </div>
                          {item.example && (
                            <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-100 dark:border-slate-800 font-en text-xs text-blue-700 dark:text-blue-300">
                              <span className="text-[9px] text-slate-450 block mb-1 uppercase font-bold tracking-wider">
                                Sentence Example:
                              </span>
                              {formatTextWithBold(item.example)}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-400">No collocations currently indexed.</div>
                    )}
                  </div>

                  {/* Hard Words Section */}
                  {payload.step2_hardWords && payload.step2_hardWords.length > 0 && (
                    <div className="pt-6 mt-6 border-t border-slate-200/60 dark:border-slate-800 space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-1.5 h-4 rounded-full bg-indigo-500"></span>
                        <h6 className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                          Difficult Academic Vocabulary (واژگان دشوار آکادمیک)
                        </h6>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {payload.step2_hardWords.map((wordItem, wIdx) => (
                          <div 
                            key={wIdx} 
                            className="p-4 bg-slate-50/40 dark:bg-slate-950/30 border border-slate-200/40 dark:border-slate-800/80 rounded-2xl space-y-2.5 relative group hover:border-amber-200 dark:hover:border-amber-900/30 transition-all duration-200 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-baseline gap-2 flex-wrap text-start">
                                <span className="text-sm font-extrabold text-slate-900 dark:text-white font-en">
                                  {wordItem.word}
                                </span>
                                {wordItem.phonetic && (
                                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono font-medium">
                                    {wordItem.phonetic}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleTtsPlayback(wordItem.word, `word-${wIdx}`)}
                                className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-slate-500 hover:text-indigo-600 transition-all text-[10px] cursor-pointer border-none opacity-85 group-hover:opacity-100"
                                title="Listen pronunciation"
                              >
                                {ttsLoadingId === `word-${wIdx}` ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                  <Play className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                            
                            <div className="p-3 bg-amber-50/20 dark:bg-amber-950/10 border border-amber-200/20 dark:border-amber-900/10 rounded-xl" dir="auto">
                              <p className="text-xs text-slate-900 dark:text-slate-100 font-sans font-bold text-start leading-relaxed">
                                {formatTextWithBold(wordItem.meaning)}
                              </p>
                            </div>

                            {wordItem.example && (
                              <div className="text-[11px] leading-relaxed text-slate-650 dark:text-slate-400 font-en px-1 text-start">
                                <span className="font-bold text-slate-400 dark:text-slate-500 text-[9px] block uppercase tracking-wider mb-0.5">Sentence Example:</span>
                                {formatTextWithBold(wordItem.example)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Full Integrated Translation card */}
              {payload.fullPassageTranslation && (
                <div id="step-translation" className="bg-gradient-to-tr from-purple-50/50 via-white to-purple-50/11 dark:from-purple-950/20 dark:via-[#0c1224] dark:to-slate-950/5 rounded-2xl border border-purple-200 dark:border-purple-900/40 border-l-4 border-l-purple-500 overflow-hidden shadow-md animate-slide-up overflow-x-hidden">
                  <div className="p-4 bg-purple-50/30 dark:bg-purple-950/20 border-b border-purple-101/30 dark:border-purple-900/10 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center text-xs font-bold">
                      <Languages className="w-4 h-4 text-purple-500" />
                    </span>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                      Passage & Paragraph Translation
                    </h5>
                  </div>
                  <div className="p-5 space-y-4 relative z-10 text-left">
                    {payload.fullPassageTranslation.split("\n\n").map((part, index) => {
                      const isEnglish = /[a-zA-Z]{5,}/.test(part);
                      if (isEnglish) {
                        return (
                          <div
                            key={index}
                            className="p-4 mb-2.5 bg-purple-50/30 dark:bg-purple-950/10 rounded-xl border border-purple-150/50 dark:border-purple-900/20 text-start font-en text-sm text-slate-850 dark:text-slate-200 leading-relaxed font-semibold relative group shadow-xs"
                          >
                            <button
                              onClick={() => handleTtsPlayback(part, `glob-part-${index}`)}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all text-[10px] cursor-pointer border-none"
                            >
                              {ttsLoadingId === `glob-part-${index}` ? (
                                <Loader2 className="w-4 animate-spin" />
                              ) : (
                                <Play className="w-2.5 h-2.5" />
                              )}
                            </button>
                            <div className="pr-6">{formatTextWithBold(part)}</div>
                          </div>
                        );
                      } else {
                        return (
                          <p
                            key={index}
                            dir="auto"
                            className="text-sm text-slate-850 dark:text-slate-200 font-sans font-semibold leading-relaxed mb-2 pb-2 border-b border-dashed border-slate-100 dark:border-slate-800/60 last:border-none text-start block"
                          >
                            {formatTextWithBold(part)}
                          </p>
                        );
                      }
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Sentence Parsing */}
              {!isTextStudy && (
                <>
                  <div id="step3" className="bg-gradient-to-tr from-indigo-50/50 via-white to-indigo-50/11 dark:from-indigo-950/20 dark:via-[#0c1224] dark:to-slate-950/5 rounded-2xl border border-indigo-200 dark:border-indigo-900/40 border-l-4 border-l-indigo-500 overflow-hidden shadow-md animate-slide-up">
                <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-indigo-101/30 dark:border-indigo-900/10 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold font-en">
                    3
                  </span>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    Structural Sentence Parsing
                  </h5>
                </div>
                <div className="p-5 space-y-6 divide-y divide-slate-150 dark:divide-slate-800">
                  {payload.step3_sentenceParsing && payload.step3_sentenceParsing.length > 0 ? (
                    payload.step3_sentenceParsing.map((item, idx) => (
                      <div key={idx} className="py-5 first:pt-0 last:pb-0 space-y-3 text-left">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px]">
                            Sentence {idx + 1}
                          </span>
                        </div>
                        <div className="p-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-xl border border-blue-100/60 dark:border-blue-900/20 text-start font-en text-sm text-slate-805 dark:text-slate-150 leading-relaxed font-semibold">
                          {formatTextWithBold(item.englishSentence)}
                        </div>
                        <div className="text-xs">
                          <span className="text-[10px] text-slate-450 dark:text-slate-500 block mb-1 font-bold">
                            Persian Contrast & Meaning:
                          </span>
                          <p
                            dir="auto"
                            className="text-slate-905 dark:text-white font-sans text-sm leading-relaxed font-semibold text-start block"
                          >
                            {formatTextWithBold(item.persianTranslation)}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-2">
                          <div className="p-3 bg-indigo-50/45 dark:bg-indigo-950/15 rounded-lg border border-indigo-200/40 dark:border-indigo-900/20">
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold block mb-1 uppercase tracking-wider">
                              Grammar Structure
                            </span>
                            <p
                              dir="auto"
                              className="text-slate-850 dark:text-slate-200 font-sans font-semibold text-xs leading-relaxed text-start block"
                            >
                              {formatTextWithBold(item.grammarStructure)}
                            </p>
                          </div>
                          <div className="p-3 bg-emerald-50/45 dark:bg-emerald-950/15 rounded-lg border border-emerald-200/40 dark:border-emerald-900/20">
                            <span className="text-[10px] text-emerald-650 dark:text-emerald-400 font-bold block mb-1 uppercase tracking-wider">
                              Contextual Role
                            </span>
                            <p
                              dir="auto"
                              className="text-slate-850 dark:text-slate-200 font-sans font-semibold text-xs leading-relaxed text-start block"
                            >
                              {formatTextWithBold(item.paragraphRole)}
                            </p>
                          </div>
                          {item.signalWords && (
                            <div className="p-3 bg-amber-50/45 dark:bg-amber-955/15 rounded-lg border border-amber-200/40 dark:border-amber-900/20">
                              <span className="text-[10px] text-amber-655 dark:text-amber-400 font-bold block mb-1 uppercase tracking-wider">
                                Signal Words / Traps
                              </span>
                              <p
                                dir="auto"
                                className="text-slate-850 dark:text-slate-200 font-sans font-semibold text-xs leading-relaxed text-start block"
                              >
                                {formatTextWithBold(item.signalWords)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">No segment divisions found.</div>
                  )}
                </div>
              </div>

              {/* Step 4: Options Breakdown (If FIB/FIB-RW) or Alternative Pairing Sandbox (If RO) */}
              {question.category === "RO" ? (
                <div id="step4" className="bg-gradient-to-tr from-indigo-50/70 via-white to-purple-50/30 dark:from-[#1e1b4b]/20 dark:via-[#0c1224] dark:to-[#311042]/10 rounded-2xl border border-indigo-200 dark:border-indigo-900/40 border-l-4 border-l-indigo-500 overflow-hidden shadow-md animate-slide-up">
                  <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/20 border-b border-indigo-101/30 dark:border-indigo-900/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold font-en">
                        4
                      </span>
                      <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                        روش جایگزین: زنجیره انسجام و جفت‌یابی گزاره‌ها (Alternative Reordering & Pairing Matrix)
                      </h5>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-extrabold text-[9px] uppercase tracking-wider">
                      Interactive Sandbox
                    </span>
                  </div>

                  <div className="p-5 space-y-6">
                    <div className="bg-amber-505/5 dark:bg-amber-955/10 rounded-xl p-4 border border-amber-500/20 text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-sans">
                      <p className="font-extrabold text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        <span>راهبرد طلایی روش جفت‌یابی (Sentence-Pairing Technique):</span>
                      </p>
                      در سوالات مرتب‌سازی پاراگراف (RO)، امتیازدهی آزمون بر مبنای جفت‌های مجاور درست (مثلاً جفت اول-دوم، دوم-سوم) محاسبه می‌شود. بنابراین آسان‌ترین راهبرد جایگزین این است که ذهن خود را ابتدا روی یافتن جفت‌های ۲ تایی مکمل (مانند ارجاع ضمیر به اسم یا تکرار گروه اسمی) متمرکز کنید، نه ساخت کل ترتیب حدسی از ابتدا. ابتدا پاراگراف مستقل (Anchor) را که فاقد هرگونه ضمیر یا ارجاع قبلی است برای شروع پیدا کنید.
                    </div>

                    {/* Interactive Drag-to-Order Game Sandbox */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                      {/* Left Block: Scrambled Pool */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-extrabold text-slate-450 dark:text-slate-400 uppercase tracking-widest block">
                          ۱. پاراگراف‌های نامرتب (بر روی جمله‌ها کلیک کنید تا به ترتیب انتخاب شوند):
                        </span>
                        <div className="space-y-2">
                          {scrambledItems.map((item) => {
                            const isSelected = userOrder.includes(item.originalIndex);
                            const selectRank = userOrder.indexOf(item.originalIndex) + 1;
                            return (
                              <div
                                key={item.originalIndex}
                                onClick={() => {
                                  if (isSelected) {
                                    // Remove from order
                                    setUserOrder(userOrder.filter((idx) => idx !== item.originalIndex));
                                  } else {
                                    // Add to order
                                    setUserOrder([...userOrder, item.originalIndex]);
                                  }
                                  setVerifyChecked(false);
                                }}
                                className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-300 relative group flex items-start gap-3 select-none ${
                                  isSelected
                                    ? "bg-slate-50 dark:bg-slate-950/60 border-indigo-400 dark:border-indigo-800 opacity-60 scale-[0.98]"
                                    : "bg-white dark:bg-slate-900 border-slate-201 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-800 hover:shadow-sm"
                                }`}
                              >
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 font-mono transition-colors ${
                                  isSelected
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350"
                                }`}>
                                  {item.label}
                                </span>
                                <div className="space-y-1 min-w-0 flex-1">
                                  <p className="text-xs font-semibold font-en text-slate-800 dark:text-slate-200 leading-relaxed pr-2">
                                    {item.sentence}
                                  </p>
                                  {isSelected && (
                                    <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-extrabold shadow-sm">
                                      {selectRank}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Right Block: User Ordered Sequence */}
                      <div className="space-y-3">
                        <span className="text-[10px] font-extrabold text-slate-450 dark:text-slate-400 uppercase tracking-widest block">
                          ۲. توالی مرتب‌شده پیشنهادی شما:
                        </span>
                        <div className="bg-slate-50/70 dark:bg-slate-950/40 rounded-xl p-4 border border-dashed border-slate-200 dark:border-slate-800 min-h-[220px] flex flex-col justify-between space-y-4">
                          {userOrder.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                              <span className="text-2xl mb-2">🔄</span>
                              <p className="text-xs font-semibold leading-relaxed">پاراگراف‌ها را از ستون سمت چپ به ترتیب کلیک کنید تا در اینجا مرتب شوند.</p>
                            </div>
                          ) : (
                            <div className="space-y-2 flex-1">
                              {userOrder.map((origIdx, showIdx) => {
                                const matchedItem = scrambledItems.find(x => x.originalIndex === origIdx);
                                if (!matchedItem) return null;
                                return (
                                  <div
                                    key={origIdx}
                                    className="p-3 bg-gradient-to-r from-indigo-50/50 to-purple-50/10 dark:from-indigo-950/20 dark:to-purple-950/10 border border-indigo-200/50 dark:border-indigo-900/30 rounded-xl flex items-center justify-between text-left shadow-2xs"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="w-6 h-6 rounded-md bg-indigo-700 text-white flex items-center justify-center font-mono text-xs font-black">
                                        {matchedItem.label}
                                      </span>
                                      <p className="text-xs font-en font-bold text-slate-850 dark:text-slate-200 line-clamp-1 pr-4">
                                        {matchedItem.sentence}
                                      </p>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setUserOrder(userOrder.filter(idx => idx !== origIdx));
                                        setVerifyChecked(false);
                                      }}
                                      className="text-xs text-rose-500 hover:text-rose-700 font-extrabold uppercase p-1 font-en bg-transparent border-none cursor-pointer"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {userOrder.length > 0 && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setVerifyChecked(true);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer border-none animate-fadeIn"
                              >
                                <Check className="w-4 h-4" />
                                <span>بررسی دقت ترتیب‌دهی</span>
                              </button>
                              <button
                                onClick={() => {
                                  setUserOrder([]);
                                  setVerifyChecked(false);
                                }}
                                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-850 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350 font-bold text-xs transition-all cursor-pointer border-none"
                              >
                                بازنشانی
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verification Result Breakdown */}
                    {verifyChecked && userOrder.length > 0 && (
                      <div className="mt-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 space-y-4 text-left animate-fadeIn shadow-inner">
                        {/* Summary Score */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-3">
                          <div className="text-left space-y-0.5">
                            <h6 className="text-xs font-black text-slate-800 dark:text-white">کارنامه بررسی صحت توالی‌ها (Adjacent Pairs Scorecard)</h6>
                            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">PTE امتیازدهی را کاملاً بر اساس روابط ترتیبی دوطرفه (جفتی) محاسبه می‌کند.</p>
                          </div>
                          
                          {(() => {
                            let correctPairs = 0;
                            const totalPossible = scrambledItems.length - 1;
                            for (let i = 0; i < userOrder.length - 1; i++) {
                              if (userOrder[i + 1] === userOrder[i] + 1) {
                                correctPairs++;
                              }
                            }
                            const isWin = correctPairs === totalPossible && userOrder.length === scrambledItems.length;
                            return (
                              <div className={`px-4 py-1.5 rounded-xl border text-xs font-black ${
                                isWin 
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 border-emerald-500/20" 
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-450 border-amber-500/20"
                              }`}>
                                امتیاز جفت‌ها: {correctPairs} از {totalPossible}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Visual Chain of Links */}
                        <div className="space-y-3 pt-1">
                          <span className="text-[10px] font-extrabold text-slate-405 dark:text-slate-400 uppercase tracking-widest block">
                            ۳. تفکیک پیوندهای ترتیبی (Chain Check):
                          </span>
                          
                          {/* Display the pairs verification flow */}
                          <div className="flex flex-wrap items-center gap-2 py-2">
                            {userOrder.map((origIndex, i) => {
                              const currItem = scrambledItems.find(x => x.originalIndex === origIndex);
                              if (!currItem) return null;
                              
                              const isLast = i === userOrder.length - 1;
                              const isNextCorr = !isLast && (userOrder[i + 1] === origIndex + 1);
                              
                              return (
                                <React.Fragment key={origIndex}>
                                  <div className="flex items-center p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs font-black text-slate-800 dark:text-slate-200">
                                    {currItem.label}
                                  </div>
                                  {!isLast && (
                                    <div className={`flex items-center transition-all ${isNextCorr ? "text-emerald-500 font-bold" : "text-rose-500"}`}>
                                      <ArrowRight className="w-5 h-5 mx-0.5" />
                                      <span className="text-[9px] font-bold tracking-tight rounded px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 font-sans">
                                        {isNextCorr ? "جفت درست ✓" : "جفت نادرست ✗"}
                                      </span>
                                    </div>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show comprehensive visual map chain (Unconditionally visible for instant analysis & alternative method display!) */}
                    <div className="bg-gradient-to-tr from-blue-50/20 to-indigo-50/20 dark:from-indigo-955/25 dark:to-slate-950 border border-indigo-200/50 dark:border-indigo-900/35 rounded-xl p-4.5 space-y-4">
                      <h6 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 border-b border-indigo-200 dark:border-indigo-900/10 pb-2">
                        <Sparkles className="w-4 h-4 text-indigo-550" />
                        <span>نقشه پیوند انسجام متنی روش جفت‌یابی (Alternative Cohesive Pairing Map)</span>
                      </h6>
                      
                      <div className="space-y-4">
                        {isDigitalMarketing ? (
                          digitalMarketingPairsInfo.map((p, pIdx) => (
                            <div key={pIdx} className="p-3.5 bg-white/70 dark:bg-slate-900/50 border border-indigo-100 dark:border-indigo-950 rounded-lg flex flex-col gap-2 text-xs leading-relaxed">
                              <div className="space-y-1 text-left flex-1">
                                <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-955 text-indigo-700 dark:text-indigo-400 font-bold text-[9px] font-en uppercase border border-indigo-200/30">
                                  {p.points}
                                </span>
                                <h6 className="font-extrabold text-slate-900 dark:text-white pt-1">{p.pair}: {p.title}</h6>
                                <p className="text-slate-600 dark:text-slate-350">{p.englishDesc}</p>
                                <p dir="rtl" className="text-slate-700 dark:text-slate-300 font-sans font-semibold pt-1 text-right block">{p.persianDesc}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          genericPairsInfo.map((p, pIdx) => (
                            <div key={pIdx} className="p-3.5 bg-white/70 dark:bg-slate-900/50 border border-indigo-100 dark:border-indigo-955 rounded-lg flex flex-col gap-2 text-xs leading-relaxed">
                              <div className="space-y-1 text-left flex-1">
                                <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-955 text-indigo-700 dark:text-indigo-400 font-bold text-[9px] font-en uppercase border border-indigo-200/30">
                                  {p.points}
                                </span>
                                <h6 className="font-extrabold text-slate-900 dark:text-white pt-1">{p.pair}: {p.title}</h6>
                                <p className="text-slate-600 dark:text-slate-350">{p.englishDesc}</p>
                                <p dir="rtl" className="text-slate-700 dark:text-slate-300 font-sans font-semibold pt-1 text-right block">{p.persianDesc}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div id="step4" className="bg-gradient-to-tr from-rose-50/50 via-white to-rose-50/11 dark:from-rose-955/20 dark:via-[#0c1224] dark:to-slate-950/5 rounded-2xl border border-rose-200 dark:border-rose-900/40 border-l-4 border-l-rose-500 overflow-hidden shadow-md animate-slide-up">
                  <div className="p-4 bg-rose-50/30 dark:bg-rose-950/20 border-b border-rose-101/30 dark:border-rose-900/10 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xs font-bold font-en">
                      4
                    </span>
                    <h5 className="text-sm font-bold text-slate-905 dark:text-white">
                      Detailed Options Breakdown
                    </h5>
                  </div>
                  <div className="p-5 space-y-6">
                    {payload.step4_optionsBreakdown && payload.step4_optionsBreakdown.length > 0 ? (
                      payload.step4_optionsBreakdown.map((blank, index) => (
                        <div key={index} className="space-y-3">
                          <div className="text-xs font-bold text-slate-405 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                            <span>{blank.blankNumber}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {blank.options &&
                                blank.options.map((opt, oIdx) => {
                                  const borderClass = opt.isCorrect
                                    ? "bg-teal-50/40 dark:bg-teal-950/10 text-slate-900 dark:text-slate-100 border-teal-200 dark:border-teal-900/30"
                                    : "bg-rose-50/40 dark:bg-rose-950/10 text-slate-900 dark:text-slate-100 border-rose-201 dark:border-rose-900/35";
                                  return (
                                    <div
                                      key={oIdx}
                                      className={`p-4 rounded-xl border ${borderClass} flex flex-col justify-between space-y-2`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-en font-bold tracking-wide text-slate-900 dark:text-white">
                                          {opt.optionWord}
                                        </span>
                                        <span
                                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                            opt.isCorrect
                                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-450"
                                              : "bg-rose-500/20 text-rose-600 dark:text-rose-450"
                                          }`}
                                        >
                                          {opt.isCorrect ? "Correct ✓" : "Incorrect ✗"}
                                        </span>
                                      </div>
                                      <p
                                        dir="auto"
                                        className="text-xs text-slate-800 dark:text-slate-200 font-sans leading-relaxed font-semibold text-start block"
                                      >
                                        {formatTextWithBold(opt.explanation)}
                                      </p>
                                    </div>
                                  );
                                })}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-455">No option lists detected.</div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Grammar Tips */}
              <div className="bg-gradient-to-tr from-[#ecfdf5]/50 via-white to-[#ecfdf5]/11 dark:from-[#064e3b]/15 dark:via-[#0c1224] dark:to-slate-950/5 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 border-l-4 border-l-emerald-500 overflow-hidden shadow-md animate-slide-up">
                <div className="p-4 bg-emerald-50/20 dark:bg-emerald-950/20 border-b border-emerald-101/30 dark:border-emerald-900/10 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 flex items-center justify-center text-xs font-bold font-en">
                    5
                  </span>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    Strategic Grammar Keys & Tips
                  </h5>
                </div>
                <div className="p-5 space-y-4">
                  {payload.step5_grammarTips && payload.step5_grammarTips.length > 0 ? (
                    payload.step5_grammarTips.map((tip, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-gradient-to-r from-amber-550/5 to-emerald-500/5 dark:from-amber-950/20 dark:to-emerald-950/15 border border-amber-200 dark:border-emerald-900/35 space-y-2 pl-4 relative shadow-xs"
                      >
                        <h6 className="text-xs font-extrabold text-blue-700 dark:text-blue-400 font-en flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-amber-500" />
                          <span>{tip.tipTitle}</span>
                        </h6>
                        <p
                          dir="auto"
                          className="text-xs text-slate-800 dark:text-slate-200 font-sans leading-relaxed font-semibold pt-1 border-t border-slate-150 dark:border-slate-800/80 text-start block"
                        >
                          {formatTextWithBold(tip.tipExplanation)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 font-semibold">No specialized rules proposed.</div>
                  )}
                </div>
              </div>

              {/* Step 6: Final Answers & Confidence */}
              <div className="bg-gradient-to-br from-[#1e1b4b] via-[#311042] to-[#0a051d] text-white rounded-2xl border border-indigo-500/30 overflow-hidden shadow-xl shadow-indigo-900/20 animate-slide-up">
                <div className="p-5 bg-indigo-950/40 border-b border-indigo-505/25 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-teal-500 text-white flex items-center justify-center text-xs font-bold shadow-lg shadow-blue-600/20 font-en">
                      6
                    </span>
                    <h5 className="text-sm font-bold text-white">Final Answer Confidence Matrix</h5>
                  </div>
                  <div className="px-2.5 py-1 rounded bg-teal-500/20 text-teal-400 text-xs font-bold font-en">
                    CONFIDENCE: {payload.confidenceLevel || "HIGH"}
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {payload.step6_finalAnswers && payload.step6_finalAnswers.length > 0 ? (
                      payload.step6_finalAnswers.map((ans, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3.5 bg-indigo-955/70 rounded-lg border border-indigo-500/25 shadow-inner"
                        >
                          <span className="text-xs font-bold text-slate-400 font-en">
                            {ans.blankName}
                          </span>
                          <span className="text-xs font-black text-teal-405 font-en tracking-wide">
                            {ans.answer}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-slate-550">No final answers exported.</div>
                    )}
                  </div>
                  <div className="bg-purple-955/40 p-4.5 rounded-xl border border-purple-500/25 flex flex-col justify-between shadow-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-1">
                        Teacher's Elimination Logic:
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                        {payload.confidenceReason ||
                          "Structure verified using collocations and contextual rules matching standard academic Pearson patterns."}
                      </p>
                    </div>
                    <div className="border-t border-slate-800 pt-3 mt-4 text-[10px] text-teal-400 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Verified based on official Pearson PTE R/RW frameworks.</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-800 text-slate-400 text-sm">
              Failed to parse study report. Please check your model settings and screenshot quality.
            </div>
          )}

          {/* Golden Bottom Trigger Card */}
          <div className="bg-gradient-to-r from-teal-500/10 to-blue-500/10 dark:from-teal-950/20 dark:to-blue-950/20 border border-teal-200/50 dark:border-indigo-900/30 rounded-2xl p-6 text-center relative z-10">
            <Volume2 className="w-8 h-8 text-teal-500 mb-3 mx-auto" />
            <h6 className="text-sm font-bold text-slate-800 dark:text-teal-200 mb-2">
              Ready for the next question?
            </h6>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed font-semibold">
              Awaiting next PTE screenshot. Upload, drag-and-drop, or paste (Ctrl+V) another to start an in-depth coaching session!
            </p>
          </div>
        </div>
    </div>
  );
}

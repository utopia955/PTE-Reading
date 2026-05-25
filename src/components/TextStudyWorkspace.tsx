import React, { useState, useRef } from "react";
import { 
  FileText, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  X, 
  Loader2, 
  Plus, 
  Save, 
  Volume2, 
  BookMarked,
  Image as ImageIcon,
  UploadCloud
} from "lucide-react";
import { speak, stopSpeech } from "../lib/tts";

interface TextStudyWorkspaceProps {
  onSaveQuestion: (data: {
    title: string;
    text: string;
    collocations: any[];
    hardWords: any[];
  }) => void;
  onClose: () => void;
  provider: string;
  apiModel: string;
  googleKey: string;
  openrouterKey: string;
  initialText?: string;
}

export default function TextStudyWorkspace({
  onSaveQuestion,
  onClose,
  provider,
  apiModel,
  googleKey,
  openrouterKey,
  initialText = "",
}: TextStudyWorkspaceProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [inputText, setInputText] = useState(initialText);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [customPhrase, setCustomPhrase] = useState("");
  
  // Results
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [ttsLoadingId, setTtsLoadingId] = useState<string | null>(null);

  // Optical Character Recognition (OCR) State
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImageForOcr = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setOcrError("Please upload a valid image file.");
      return;
    }
    setIsOcrLoading(true);
    setOcrError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;

      const res = await fetch("/api/detect-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64Data,
          model: apiModel,
          provider: provider,
          apiKey: provider === "openrouter" ? openrouterKey : googleKey,
        }),
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj?.error || `OCR detection failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.text) {
        setInputText((prev) => (prev ? prev + "\n" + data.text : data.text));
      } else {
        throw new Error("No readable text found in the image.");
      }
    } catch (err: any) {
      console.error(err);
      setOcrError(err?.message || "Failed to parse text from image.");
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault(); // Stop normal pasting block
          processImageForOcr(file);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageForOcr(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageForOcr(e.dataTransfer.files[0]);
    }
  };

  // Helper to tokenise input text into clickable words
  const textWords = React.useMemo(() => {
    if (!inputText) return [];
    return inputText.split(/(\s+)/); // Preserve spaces for accurate visual formatting
  }, [inputText]);

  // Clean a word for lookup by stripping leading/trailing punctuation and lowercase
  const getCleanWord = (word: string) => {
    return word.replace(/^[^\w\s']+|[^\w\s']+(?=\s|$)/g, "").trim();
  };

  const handleToggleClickWord = (rawWord: string) => {
    const cleaned = getCleanWord(rawWord);
    if (!cleaned || cleaned.length < 2) return;
    
    // Toggle
    setSelectedWords(prev => {
      const isExist = prev.some(w => w.toLowerCase() === cleaned.toLowerCase());
      if (isExist) {
        return prev.filter(w => w.toLowerCase() !== cleaned.toLowerCase());
      } else {
        return [...prev, cleaned];
      }
    });
  };

  const handleAddCustomPhrase = () => {
    const trimmed = customPhrase.trim();
    if (!trimmed) return;
    
    setSelectedWords(prev => {
      if (prev.some(w => w.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      return [...prev, trimmed];
    });
    setCustomPhrase("");
  };

  const handleAddHighlightedText = () => {
    if (typeof window === "undefined") return;
    const highlight = window.getSelection()?.toString().trim();
    
    if (highlight && highlight.length > 1 && highlight.length < 80) {
      setSelectedWords(prev => {
        if (prev.some(w => w.toLowerCase() === highlight.toLowerCase())) {
          return prev;
        }
        return [...prev, highlight];
      });
    }
  };

  const handleRemoveWord = (wordToRemove: string) => {
    setSelectedWords(prev => prev.filter(w => w !== wordToRemove));
  };

  const triggerTts = (text: string, id: string) => {
    if (ttsLoadingId === id) {
      stopSpeech();
      setTtsLoadingId(null);
      return;
    }
    setTtsLoadingId(id);
    speak(text, () => setTtsLoadingId(null));
  };

  // call our backend `/api/analyze-words`
  const runLexicalAnalysis = async () => {
    if (selectedWords.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setStep(3);

    try {
      const res = await fetch("/api/analyze-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          selectedItems: selectedWords,
          model: apiModel,
          provider: provider,
          apiKey: provider === "openrouter" ? openrouterKey : googleKey,
        }),
      });

      if (!res.ok) {
        const errObj = await res.json().catch(() => ({}));
        throw new Error(errObj?.error || `Analysis failed with status ${res.status}`);
      }

      const result = await res.json();
      setAnalysisResult(result);
    } catch (err: any) {
      console.error(err);
      setAnalysisError(err?.message || "An exception occurred while contacting the Gemini analyzer.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveToHub = () => {
    if (!analysisResult) return;
    
    onSaveQuestion({
      title: analysisResult.passageTitle || "Pasted Passage Study",
      text: analysisResult.fullPassageTranslation || inputText,
      collocations: analysisResult.step2_collocations || [],
      hardWords: analysisResult.step2_hardWords || [],
    });
    setIsSaved(true);
  };

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-[32px] border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-2xl relative overflow-hidden transition-all text-left">
      <div className="absolute inset-0 opacity-2 pointer-events-none" style={{ backgroundImage: "radial-gradient(#2563eb 1.5px, transparent 1.5px)", backgroundSize: "32px 32px" }}></div>
      
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800 dark:text-white">Lexical Clipboard & Word Extractor</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Study difficult words, collocations or speaking text on-demand</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer border-none bg-transparent"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress indicators wrapper */}
      <div className="mb-6 grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
        {[
          { label: "1. Paste Text Passage", active: step >= 1 },
          { label: "2. Select Key Words", active: step >= 2 },
          { label: "3. AI Meaning Dissection", active: step >= 3 },
        ].map((s, idx) => (
          <div
            key={idx}
            className={`py-2 px-1 rounded-lg border transition-all ${
              step === idx + 1
                ? "bg-blue-500/15 border-blue-400/50 text-blue-700 dark:text-blue-300 font-extrabold"
                : s.active
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-50 dark:bg-slate-900/40 border-slate-250 dark:border-slate-800/80 text-slate-450 dark:text-slate-600"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>

      {/* STEP 1: Paste Text */}
      {step === 1 && (
        <div className="space-y-4 relative z-10 animate-slide-up">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Paste or type any passage you are studying, or upload/paste an image of the text to use visual OCR:
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* TextArea input taking 2/3 space on large screens */}
            <div className="lg:col-span-2 flex flex-col space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-505">Text Context Editor</label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handlePaste}
                placeholder="Type, paste text context here, or press Ctrl+V / Cmd+V with an image copied in your clipboard..."
                rows={9}
                className="w-full h-full text-sm p-4 bg-slate-50 dark:bg-slate-900 border border-slate-205 dark:border-slate-755 rounded-2xl focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 text-left leading-relaxed font-sans min-h-[220px]"
              />
            </div>

            {/* Visual OCR Drag & Drop dropzone taking 1/3 space */}
            <div className="flex flex-col space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-455 dark:text-slate-505">Extract Text From Image (OCR)</label>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 min-h-[220px] lg:min-h-0 border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden ${
                  dragActive
                    ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20"
                    : "border-slate-200 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {isOcrLoading ? (
                  <div className="space-y-2.5 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <span className="text-xs font-bold text-slate-750 dark:text-slate-200">Extracting text with AI...</span>
                    <span className="text-[10px] text-slate-450">Running OCR scanner</span>
                  </div>
                ) : (
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-700 dark:text-slate-350">
                        Upload or Drop Image
                      </span>
                      <span className="block text-[10px] text-slate-450 mt-1">
                        Supports screenshot pasting, custom files, png, jpeg
                      </span>
                    </div>
                  </div>
                )}

                {ocrError && (
                  <div className="absolute bottom-1 left-2 right-2 bg-rose-50 dark:bg-rose-955 px-2 py-1 rounded text-[10px] text-rose-600 dark:text-rose-400 font-bold border border-rose-100 dark:border-rose-900">
                    {ocrError}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer border-none bg-transparent"
            >
              Cancel
            </button>
            <button
              disabled={!inputText.trim() || isOcrLoading}
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer border-none"
            >
              <span>Next: Select Words</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Word / Collocation Selection */}
      {step === 2 && (
        <div className="space-y-6 relative z-10">
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-850">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Passage Viewer</h4>
              <button
                onClick={() => triggerTts(inputText, "original-passage-step2")}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-250 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-300 rounded-lg flex items-center gap-1.5 cursor-pointer border-none transition-all text-[11px] font-bold"
                title="Click to hear the full main passage"
              >
                {ttsLoadingId === "original-passage-step2" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Stop Listening</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    <span>Listen To Main Passage</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-450 dark:text-slate-500 font-semibold mb-3">
              💡 <b>Click</b> on any individual word to instantly select it, or <b>highlight</b> multiple words (collocation phrase) and click target button below!
            </p>
            
            {/* Clickable paragraph block */}
            <div className="text-sm leading-relaxed text-slate-800 dark:text-slate-150 bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-sans select-text">
              {textWords.map((token, idx) => {
                const cleaned = getCleanWord(token);
                // Check if space (formatting)
                if (!cleaned) {
                  return <span key={idx}>{token}</span>;
                }
                const isSelected = selectedWords.some(w => w.toLowerCase() === cleaned.toLowerCase());
                return (
                  <span
                    key={idx}
                    onClick={() => handleToggleClickWord(token)}
                    className={`inline-block px-1 cursor-pointer rounded transition-all font-medium ${
                      isSelected
                        ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 font-extrabold border border-blue-500/30 -mx-[1px]"
                        : "hover:bg-slate-150 dark:hover:bg-slate-800"
                    }`}
                  >
                    {token}
                  </span>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAddHighlightedText}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-205 rounded-lg transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                + Add Highlighted Text Selection
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Custom Manual phrase input */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Add collocations (multi-word expression):</h4>
                <p className="text-[10px] text-slate-500 mb-3 font-semibold">Type custom combinations directly (e.g. 'acquire a language')</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. deeply fundamental"
                  value={customPhrase}
                  onChange={(e) => setCustomPhrase(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCustomPhrase()}
                  className="flex-1 bg-white dark:bg-slate-950 text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none"
                />
                <button
                  onClick={handleAddCustomPhrase}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer border-none"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Selected checklist badges */}
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 flex flex-col justify-between min-h-[120px]">
              <div>
                <h4 className="text-xs font-bold text-slate-750 dark:text-slate-300 uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span>Selected Elements</span>
                  <span className="text-[10px] bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-black">
                    {selectedWords.length} Item(s)
                  </span>
                </h4>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[140px] pr-1 mt-2 flex flex-wrap gap-1.5 items-start">
                {selectedWords.length === 0 ? (
                  <span className="text-[11px] text-slate-450 italic mt-2">No selections registered. Click words or add expressions.</span>
                ) : (
                  selectedWords.map((word) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-500/20 shadow-2xs"
                    >
                      <span>{word}</span>
                      <button
                        onClick={() => handleRemoveWord(word)}
                        className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-900 text-indigo-400 hover:text-indigo-600 rounded-full transition-colors cursor-pointer border-none bg-transparent"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 text-xs font-bold text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer border-none bg-transparent flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              disabled={selectedWords.length === 0}
              onClick={runLexicalAnalysis}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:pointer-events-none text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-blue-500/15 flex items-center gap-2 cursor-pointer border-none"
            >
              <Sparkles className="w-4 h-4" />
              <span>Analyze with Gemini-AI 🪄</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Analysis Result & Save */}
      {step === 3 && (
        <div className="space-y-6 relative z-10">
          
          {/* Loading state for analysis */}
          {isAnalyzing && (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
              </div>
              <h4 className="text-sm font-black text-slate-800 dark:text-white">Gemini Lexical Structuring Matrix Core...</h4>
              <p className="text-xs text-slate-450 dark:text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                Analyzing word pronunciation phonetics, translating passage segments and parsing contextual structures.
              </p>
            </div>
          )}

          {/* Analysis Error */}
          {analysisError && (
            <div className="p-5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl text-center space-y-4">
              <p className="text-xs text-rose-700 dark:text-rose-400 font-bold leading-normal">{analysisError}</p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs text-slate-700 dark:text-white rounded-lg transition-all"
                >
                  Return to Selection
                </button>
                <button
                  onClick={runLexicalAnalysis}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white rounded-lg transition-all"
                >
                  Retry Analysis
                </button>
              </div>
            </div>
          )}

          {/* Render Result */}
          {!isAnalyzing && !analysisError && analysisResult && (
            <div className="space-y-6">
              
              {/* Passage Full translation block */}
              <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#6366f1] dark:text-[#a5b4fc]">
                    Passage Translation & Bilingual Reading
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerTts(inputText, "original-passage-step3")}
                      className="px-2.5 py-1 text-[11px] font-black bg-indigo-100 hover:bg-indigo-200 dark:bg-[#6366f1]/15 dark:hover:bg-[#6366f1]/35 text-indigo-700 dark:text-[#a5b4fc] border border-indigo-200/50 dark:border-[#6366f1]/20 rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                      title="Read full original passage via TTS"
                    >
                      {ttsLoadingId === "original-passage-step3" ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Stop full speech</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3 h-3" />
                          <span>Listen Full Passage</span>
                        </>
                      )}
                    </button>
                    <span className="text-xs bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-lg">
                      Title: {analysisResult.passageTitle}
                    </span>
                  </div>
                </div>
                
                <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-150 space-y-3 font-sans max-h-[300px] overflow-y-auto pr-1">
                  {analysisResult.fullPassageTranslation.split("\n\n").map((para: string, idx: number) => {
                    const isPersian = /[\u0600-\u06FF]/.test(para);
                    if (!isPersian) {
                      return (
                        <div key={idx} className="relative group p-3 rounded-xl bg-indigo-50/10 dark:bg-slate-950/40 border border-indigo-100/30 dark:border-slate-800/60 flex items-start gap-4 hover:border-indigo-500/30 transition-all select-text mt-1">
                          <div className="flex-1 pr-8 text-left">
                            <p className="text-slate-800 dark:text-slate-200 font-sans leading-relaxed break-words whitespace-pre-wrap text-sm font-semibold">
                              {para}
                            </p>
                          </div>
                          <button
                            onClick={() => triggerTts(para, `passage-para-${idx}`)}
                            className="absolute right-2 top-2 p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-705 text-slate-500 dark:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all border-none opacity-60 hover:opacity-100"
                            title="Listen to this paragraph"
                          >
                            {ttsLoadingId === `passage-para-${idx}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    } else {
                      return (
                        <p 
                          key={idx} 
                          className="text-right font-fa font-bold opacity-90 text-sm border-r-2 border-indigo-500/40 pr-3.5 py-1.5 whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-205 mb-2"
                          dir="rtl"
                        >
                          {para}
                        </p>
                      );
                    }
                  })}
                </div>
              </div>

              {/* Grid of parsed items */}
              <div className="grid grid-cols-1 gap-4">
                
                {/* Collocations */}
                {analysisResult.step2_collocations && analysisResult.step2_collocations.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Parsed Collocations ({analysisResult.step2_collocations.length})
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysisResult.step2_collocations.map((item: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="bg-white dark:bg-[#121A30]/50 border border-slate-200 dark:border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between shadow-2xs text-left"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 border-b border-slate-50 dark:border-slate-800 pb-2 mb-2">
                              <span className="font-extrabold text-xs text-blue-600 dark:text-blue-400 capitalize">{item.englishCollocation}</span>
                              <button
                                onClick={() => triggerTts(item.englishCollocation, `col-${idx}`)}
                                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all border-none"
                                title="Listen to pronunciation"
                              >
                                {ttsLoadingId === `col-${idx}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Volume2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <h6 className="font-bold text-slate-800 dark:text-indigo-200 text-xs text-right mb-1" dir="rtl">
                              {item.persianMeaning}
                            </h6>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-semibold mb-2">
                              <b>Significance:</b> {item.importance}
                            </p>
                          </div>
                          {item.example && (
                            <p className="text-[10.5px] italic text-slate-600 dark:text-slate-300 leading-normal bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/40">
                              "{item.example}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single Hard Words */}
                {analysisResult.step2_hardWords && analysisResult.step2_hardWords.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h5 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Extracted Vocabulary Dictionary ({analysisResult.step2_hardWords.length})
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysisResult.step2_hardWords.map((item: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="bg-white dark:bg-[#121A30]/50 border border-slate-205 dark:border-white/[0.04] rounded-2xl p-4 flex flex-col justify-between shadow-xs text-left"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                              <div className="flex items-baseline gap-2">
                                <span className="font-black text-xs text-indigo-650 dark:text-indigo-400">{item.word}</span>
                                {item.phonetic && (
                                  <span className="font-mono text-[9.5px] text-slate-400 dark:text-slate-500">{item.phonetic}</span>
                                )}
                              </div>
                              <button
                                onClick={() => triggerTts(item.word, `word-${idx}`)}
                                className="w-7 h-7 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-white rounded-lg flex items-center justify-center cursor-pointer transition-all border-none"
                                title="Listen to pronunciation"
                              >
                                {ttsLoadingId === `word-${idx}` ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Volume2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <h6 className="font-bold text-slate-900 dark:text-indigo-200 text-xs text-right mb-2" dir="rtl">
                              {item.meaning}
                            </h6>
                          </div>
                          {item.example && (
                            <p className="text-[10.5px] italic text-slate-650 dark:text-slate-300 leading-normal bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800/40">
                              "{item.example}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* Footer Save Row */}
              <div className="flex justify-between items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-650 dark:text-slate-450 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer border-none bg-transparent flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Adjust Selections</span>
                </button>
                
                {isSaved ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-100/40 dark:bg-emerald-500/10 border border-emerald-555 px-4 py-2.5 rounded-xl">
                    <Check className="w-4 h-4" />
                    <span>Persisted to Vocabulary Hub Successfully!</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveToHub}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-650 to-teal-650 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-500/15 flex items-center gap-2 cursor-pointer border-none"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save to History & Collocations Hub</span>
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}

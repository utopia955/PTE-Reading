export type QuestionCategory = "FIB-R" | "FIB-RW" | "RO" | "MCQ";
export type MasteryStatus = "needs-review" | "mastered" | "critical";

export interface CollocationItem {
  englishCollocation: string;
  persianMeaning: string;
  importance: string;
  example?: string;
}

export interface HardWordItem {
  word: string;
  phonetic?: string;
  meaning: string;
  example?: string;
}

export interface SentenceParsingItem {
  englishSentence: string;
  persianTranslation: string;
  grammarStructure: string;
  paragraphRole: string;
  signalWords?: string;
}

export interface OptionItem {
  optionWord: string;
  isCorrect: boolean;
  explanation: string;
}

export interface OptionsBreakdownItem {
  blankNumber: string;
  options: OptionItem[];
}

export interface GrammarTipItem {
  tipTitle: string;
  tipExplanation: string;
}

export interface FinalAnswerItem {
  blankName: string;
  answer: string;
}

export interface AnalysisPayload {
  step1_questionType: string;
  fullPassageTranslation: string;
  step2_collocations: CollocationItem[];
  step2_hardWords?: HardWordItem[];
  step3_sentenceParsing: SentenceParsingItem[];
  step4_optionsBreakdown: OptionsBreakdownItem[];
  step5_grammarTips: GrammarTipItem[];
  step6_finalAnswers: FinalAnswerItem[];
  confidenceLevel: string;
  confidenceReason: string;
}

export interface SavedQuestion {
  id: string;
  title: string;
  category: QuestionCategory;
  date: string;
  timestamp: number;
  note: string;
  status: MasteryStatus;
  images: string[];
  rawResponse: string; // Stored JSON payload string
  isStarred?: boolean;
}

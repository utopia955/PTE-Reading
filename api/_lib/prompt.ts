// Shared analysis prompt + output shape used by every provider so that Google
// and OpenRouter return an identical JSON structure that the client can render.

export const SYSTEM_PROMPT = `You are an expert PTE Core Reading Coach.
Analyze the provided screenshots of a PTE Core Reading question. Extract the content and produce a structured study guide using the specified schema.

CRITICAL INSTRUCTIONS FOR ANALYSIS:
1. Identify the question type accurately (e.g., Fill in the Blanks (Reading), Fill in the Blanks (Reading & Writing), Reorder Paragraphs, or Multiple Choice).
2. Read the entire passage carefully. Provide a full English extraction and a beautifully fluent, cohesive, natural Persian translation.
3. Extract 4 to 8 critical vocabulary items, collocations, or academic expressions found in the text. Translate and explain their importance.
4. Break down the passage sentence-by-sentence. Discuss grammatical structure, role in the paragraph, and any signal words.
5. Provide a detailed analysis of options for EACH blank, explaining clearly in Persian why incorrect options are wrong and why correct ones are right based on syntax and meaning.
6. Share 3 to 5 clear, actionable grammar tips or gold-key patterns inspired by the text.
7. Output final answers with confidence level (HIGH/MEDIUM/LOW) and reasoning.`;

// A plain-text description of the required JSON, appended to the prompt for
// providers (OpenRouter) that don't support a strict response schema object.
export const JSON_SHAPE_INSTRUCTIONS = `
Respond with a SINGLE valid JSON object (no markdown fences, no commentary) using EXACTLY this shape:
{
  "step1_questionType": string,
  "fullPassageTranslation": string, // full English passage, a blank line, then the cohesive Persian translation
  "step2_collocations": [ { "englishCollocation": string, "persianMeaning": string, "importance": string, "example": string } ],
  "step3_sentenceParsing": [ { "englishSentence": string, "persianTranslation": string, "grammarStructure": string, "paragraphRole": string, "signalWords": string } ],
  "step4_optionsBreakdown": [ { "blankNumber": string, "options": [ { "optionWord": string, "isCorrect": boolean, "explanation": string } ] } ],
  "step5_grammarTips": [ { "tipTitle": string, "tipExplanation": string } ],
  "step6_finalAnswers": [ { "blankName": string, "answer": string } ],
  "confidenceLevel": string,
  "confidenceReason": string
}
All Persian text must be fluent and natural. Do not omit any top-level key.`;

export const REQUIRED_KEYS = [
  "step1_questionType",
  "fullPassageTranslation",
  "step2_collocations",
  "step3_sentenceParsing",
  "step4_optionsBreakdown",
  "step5_grammarTips",
  "step6_finalAnswers",
  "confidenceLevel",
  "confidenceReason",
];

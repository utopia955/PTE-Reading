// Provider abstraction: routes an analysis/TTS request to Google or OpenRouter.
// Both providers return an identical JSON object shape (see prompt.ts).

import { GoogleGenAI, Type, Modality } from "@google/genai";
import { getModel, type ProviderId } from "./models";
import {
  SYSTEM_PROMPT,
  JSON_SHAPE_INSTRUCTIONS,
  REQUIRED_KEYS,
} from "./prompt";

const GOOGLE_HTTP_OPTIONS = { headers: { "User-Agent": "aistudio-build" } };

export interface AnalyzeArgs {
  provider: ProviderId;
  modelId: string;
  apiKey?: string;
  images: string[];
}

export interface TtsArgs {
  text: string;
  voice?: string;
  apiKey?: string;
}

/** Resolve the user-facing model id to the provider's actual model string,
 *  honouring optional environment overrides so the deployment can be corrected
 *  without code changes if Google/OpenRouter rename a model. */
export function resolveModelString(modelId: string, provider: ProviderId): string {
  const m = getModel(modelId);
  if (provider === "openrouter") {
    if (modelId === "gemini-3.1-flash-lite")
      return process.env.OPENROUTER_MODEL_FLASH_LITE || m.openrouter;
    if (modelId === "gemma-4-31b")
      return process.env.OPENROUTER_MODEL_GEMMA || m.openrouter;
    return m.openrouter;
  }
  if (modelId === "gemini-3.1-flash-lite")
    return process.env.GOOGLE_MODEL_FLASH_LITE || m.google;
  if (modelId === "gemma-4-31b")
    return process.env.GOOGLE_MODEL_GEMMA || m.google;
  return m.google;
}

/** Pick the right key for a provider: explicit user key wins, env is the fallback. */
export function resolveApiKey(provider: ProviderId, userKey?: string): string | undefined {
  const trimmed = userKey && userKey.trim() !== "" ? userKey.trim() : undefined;
  if (trimmed) return trimmed;
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY || undefined;
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
}

function normalizeImage(dataUrl: string): { mimeType: string; data: string; full: string } {
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return { mimeType: matches[1], data: matches[2], full: dataUrl };
  }
  const data = dataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
  return { mimeType: "image/png", data, full: `data:image/png;base64,${data}` };
}

/** Strip markdown fences / prose and parse a JSON object out of a model reply. */
function extractJson(text: string): any {
  if (!text) throw new Error("Empty model response.");
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      /* fall through */
    }
  }
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(text.slice(first, last + 1));
  }
  throw new Error("Model did not return parseable JSON.");
}

function ensureShape(obj: any): any {
  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) {
      // Fill missing arrays/strings so the UI never crashes on a partial reply.
      obj[key] = key.startsWith("step") && key !== "step1_questionType" ? [] : "";
    }
  }
  return obj;
}

const GOOGLE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    step1_questionType: { type: Type.STRING },
    fullPassageTranslation: {
      type: Type.STRING,
      description:
        "Entire extracted English reading passage, followed by an elegant double line break, and then its cohesive, high-quality, flowy Persian translation.",
    },
    step2_collocations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          englishCollocation: { type: Type.STRING },
          persianMeaning: { type: Type.STRING },
          importance: { type: Type.STRING },
          example: { type: Type.STRING },
        },
        required: ["englishCollocation", "persianMeaning", "importance"],
      },
    },
    step3_sentenceParsing: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          englishSentence: { type: Type.STRING },
          persianTranslation: { type: Type.STRING },
          grammarStructure: { type: Type.STRING },
          paragraphRole: { type: Type.STRING },
          signalWords: { type: Type.STRING },
        },
        required: ["englishSentence", "persianTranslation", "grammarStructure", "paragraphRole"],
      },
    },
    step4_optionsBreakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blankNumber: { type: Type.STRING, description: "e.g., 'Blank 1' or 'Gap 1'" },
          options: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                optionWord: { type: Type.STRING },
                isCorrect: { type: Type.BOOLEAN },
                explanation: {
                  type: Type.STRING,
                  description: "Detailed explanation in fluent Persian why this is correct/incorrect.",
                },
              },
              required: ["optionWord", "isCorrect", "explanation"],
            },
          },
        },
        required: ["blankNumber", "options"],
      },
    },
    step5_grammarTips: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          tipTitle: { type: Type.STRING },
          tipExplanation: { type: Type.STRING },
        },
        required: ["tipTitle", "tipExplanation"],
      },
    },
    step6_finalAnswers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          blankName: { type: Type.STRING },
          answer: { type: Type.STRING },
        },
        required: ["blankName", "answer"],
      },
    },
    confidenceLevel: { type: Type.STRING },
    confidenceReason: { type: Type.STRING },
  },
  required: REQUIRED_KEYS,
};

async function runGoogleAnalysis(args: AnalyzeArgs, apiKey: string): Promise<any> {
  const client = new GoogleGenAI({ apiKey, httpOptions: GOOGLE_HTTP_OPTIONS });
  const targetModel = resolveModelString(args.modelId, "google");
  const model = getModel(args.modelId);

  const parts: any[] = [{ text: SYSTEM_PROMPT }];
  for (const img of args.images) {
    const { mimeType, data } = normalizeImage(img);
    parts.push({ inlineData: { mimeType, data } });
  }

  // Gemma models on the Generative Language API don't support a JSON response
  // schema, so we instruct via prompt and parse the text instead.
  const useSchema = model.vision;
  if (!useSchema) parts[0] = { text: SYSTEM_PROMPT + JSON_SHAPE_INSTRUCTIONS };

  const response = await client.models.generateContent({
    model: targetModel,
    contents: { parts },
    config: useSchema
      ? { responseMimeType: "application/json", responseSchema: GOOGLE_RESPONSE_SCHEMA }
      : {},
  });

  if (!response.text) throw new Error("No payload returned from the Google analyzer.");
  return ensureShape(extractJson(response.text));
}

async function runOpenRouterAnalysis(args: AnalyzeArgs, apiKey: string): Promise<any> {
  const targetModel = resolveModelString(args.modelId, "openrouter");

  const content: any[] = [{ type: "text", text: SYSTEM_PROMPT + JSON_SHAPE_INSTRUCTIONS }];
  for (const img of args.images) {
    const { full } = normalizeImage(img);
    content.push({ type: "image_url", image_url: { url: full } });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://pte-core-reading-coach.vercel.app",
      "X-Title": "PTE Core Reading Coach",
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  const json: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message || `OpenRouter request failed (${res.status}).`);
  }
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned no content.");
  return ensureShape(extractJson(typeof text === "string" ? text : JSON.stringify(text)));
}

export async function runAnalysis(args: AnalyzeArgs): Promise<any> {
  if (!args.images || args.images.length === 0) {
    throw new Error("No image components supplied.");
  }
  const apiKey = resolveApiKey(args.provider, args.apiKey);
  if (!apiKey) {
    const where = args.provider === "openrouter" ? "OpenRouter" : "Google";
    throw new Error(`Missing ${where} API key. Add one in Settings or configure it on the server.`);
  }
  return args.provider === "openrouter"
    ? runOpenRouterAnalysis(args, apiKey)
    : runGoogleAnalysis(args, apiKey);
}

// --- Text to speech (Google only; the client falls back to Web Speech) ---

function pcmToWavBase64(pcmBase64: string, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): string {
  const pcm = Buffer.from(pcmBase64, "base64");
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
}

function sampleRateFromMime(mime?: string): number {
  if (!mime) return 24000;
  const m = mime.match(/rate=(\d+)/);
  return m ? parseInt(m[1], 10) : 24000;
}

export async function runTts(args: TtsArgs): Promise<string> {
  const apiKey = resolveApiKey("google", args.apiKey);
  if (!apiKey) {
    // No Google key available — signal the client to use its Web Speech fallback.
    throw new Error("NO_GOOGLE_KEY");
  }
  const client = new GoogleGenAI({ apiKey, httpOptions: GOOGLE_HTTP_OPTIONS });
  const ttsModel = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
  const voiceName = args.voice || "Kore";

  const response = await client.models.generateContent({
    model: ttsModel,
    contents: [{ parts: [{ text: args.text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const base64Audio = part?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio output from the speech synthesizer.");

  // Gemini returns raw PCM (L16). Wrap it in a WAV container so browsers play it.
  return pcmToWavBase64(base64Audio, sampleRateFromMime(part?.inlineData?.mimeType));
}

// Provider abstraction: routes an analysis/TTS request to Google or OpenRouter.
// Both providers return an identical JSON object shape (see prompt.ts).

import { GoogleGenAI, Type, Modality } from "@google/genai";
import WebSocket from "ws";
import crypto from "crypto";
import { getModel, type ProviderId } from "./models.js";
import {
  SYSTEM_PROMPT,
  JSON_SHAPE_INSTRUCTIONS,
  REQUIRED_KEYS,
} from "./prompt.js";

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
    passageTitle: { type: Type.STRING },
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
    step2_hardWords: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          meaning: { type: Type.STRING },
          example: { type: Type.STRING },
        },
        required: ["word", "meaning"],
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
  try {
    return await (args.provider === "openrouter"
      ? runOpenRouterAnalysis(args, apiKey)
      : runGoogleAnalysis(args, apiKey));
  } catch (error: any) {
    console.error(`[runAnalysis Error] provider=${args.provider}`, error);
    // GenAI SDK errors often have a stringified JSON in message, extract readable text if possible
    let msg = error?.message || String(error);
    try {
      if (msg.startsWith("{") && msg.includes('"error"')) {
        const parsed = JSON.parse(msg);
        if (parsed.error?.message) {
          msg = parsed.error.message;
        }
      }
    } catch {
      // Keep original msg
    }
    throw new Error(msg);
  }
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

const WORDS_ANALYSIS_SYSTEM_PROMPT = `You are an expert PTE Academic and General Reading & Vocabulary Coach.
The user will provide a text passage they are studying (which could be a Read Aloud prompt, Essay snippet, etc.), along with a specific roster of selected words, collocations, or multi-word academic expressions from that passage.

Critically analyze these selected items in the direct context of the passage.

Produce a highly professional, JSON structured guide. For EACH selected item, classify it as either a 'collocation' (academic multi-word phrase, idiomatic expression, or verb-noun pairing) or a 'hardWord' (a single difficult or advanced academic word) based on standard linguistic definitions.

Provide:
1. A descriptive, academic-style passage title (2 to 5 words).
2. A pristine, beautiful, fluent Persian translation of the entire original passage context (separated by a blank line after the original English text).
3. For collocations (step2_collocations):
   - englishCollocation: The exact phrase.
   - persianMeaning: High quality, context-appropriate Persian meaning.
   - importance: Why it's crucial for PTE exam task, academic value, or grammar tip.
   - example: A natural, clear standard English example application.
4. For single hard words (step2_hardWords):
   - word: The exact word.
   - phonetic: High contrast, precise IPA pronunciation (e.g., /prəˈfaʊnd/).
   - meaning: Fluent translation of the word's meaning in Persian.
   - example: An elegant, practical standard English example sentence.`;

const WORDS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    passageTitle: { type: Type.STRING },
    fullPassageTranslation: {
      type: Type.STRING,
      description: "Original English passage text followed by a double line break, and its beautiful, cohesive Persian translation.",
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
    step2_hardWords: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          phonetic: { type: Type.STRING },
          meaning: { type: Type.STRING },
          example: { type: Type.STRING },
        },
        required: ["word", "meaning"],
      },
    },
  },
  required: ["passageTitle", "fullPassageTranslation", "step2_collocations", "step2_hardWords"],
};

export interface AnalyzeWordsArgs {
  provider: ProviderId;
  modelId: string;
  apiKey?: string;
  text: string;
  selectedItems: string[];
}

async function runGoogleWordsAnalysis(args: AnalyzeWordsArgs, apiKey: string): Promise<any> {
  const client = new GoogleGenAI({ apiKey, httpOptions: GOOGLE_HTTP_OPTIONS });
  const targetModel = resolveModelString(args.modelId, "google");

  const prompt = `Passage Context:\n${args.text}\n\nSelected Items to Analyze:\n${JSON.stringify(args.selectedItems)}`;

  const response = await client.models.generateContent({
    model: targetModel,
    contents: [
      { text: WORDS_ANALYSIS_SYSTEM_PROMPT },
      { text: prompt }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: WORDS_RESPONSE_SCHEMA,
    },
  });

  if (!response.text) throw new Error("No payload returned from the Google vocabulary analyzer.");
  return extractJson(response.text);
}

async function runOpenRouterWordsAnalysis(args: AnalyzeWordsArgs, apiKey: string): Promise<any> {
  const targetModel = resolveModelString(args.modelId, "openrouter");

  const prompt = `Passage Context:\n${args.text}\n\nSelected Items to Analyze:\n${JSON.stringify(args.selectedItems)}`;
  const jsonInstructions = `\n\nReturn EXACTLY a JSON response with this shape:
{
  "passageTitle": string,
  "fullPassageTranslation": string,
  "step2_collocations": [ { "englishCollocation": string, "persianMeaning": string, "importance": string, "example": string } ],
  "step2_hardWords": [ { "word": string, "phonetic": string, "meaning": string, "example": string } ]
}`;

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
      messages: [
        { role: "system", content: WORDS_ANALYSIS_SYSTEM_PROMPT + jsonInstructions },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  const json: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message || `OpenRouter request failed (${res.status}).`);
  }
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter words analyzer returned no content.");
  return extractJson(typeof text === "string" ? text : JSON.stringify(text));
}

export async function runWordsAnalysis(args: AnalyzeWordsArgs): Promise<any> {
  if (!args.text || !args.text.trim()) {
    throw new Error("No text context supplied.");
  }
  if (!args.selectedItems || args.selectedItems.length === 0) {
    throw new Error("No specific words or collocations were selected for study.");
  }
  const apiKey = resolveApiKey(args.provider, args.apiKey);
  if (!apiKey) {
    const where = args.provider === "openrouter" ? "OpenRouter" : "Google";
    throw new Error(`Missing ${where} API key. Add one in Settings or configure it on the server.`);
  }
  try {
    const rawResult = await (args.provider === "openrouter"
      ? runOpenRouterWordsAnalysis(args, apiKey)
      : runGoogleWordsAnalysis(args, apiKey));
    
    // Normalize into standard AnalysisPayload compatible fields
    return {
      step1_questionType: "Text Clipboard Study",
      passageTitle: rawResult.passageTitle || "Pasted Passage Study",
      fullPassageTranslation: rawResult.fullPassageTranslation || args.text,
      step2_collocations: rawResult.step2_collocations || [],
      step2_hardWords: rawResult.step2_hardWords || [],
      step3_sentenceParsing: [],
      step4_optionsBreakdown: [],
      step5_grammarTips: [],
      step6_finalAnswers: [],
      confidenceLevel: "HIGH",
      confidenceReason: "Custom selected vocabulary analyzed."
    };
  } catch (error: any) {
    console.error(`[runWordsAnalysis Error] provider=${args.provider}`, error);
    let msg = error?.message || String(error);
    try {
      if (msg.startsWith("{") && msg.includes('"error"')) {
        const parsed = JSON.parse(msg);
        if (parsed.error?.message) {
          msg = parsed.error.message;
        }
      }
    } catch {
      // Keep original msg
    }
    throw new Error(msg);
  }
}

function uuidv32(): string {
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateSecMsGecVersion(): string {
  const WINDOWS_EPOCH_OFFSET = 11644473600n; // Seconds difference 1601 to 1970
  const nowUnixSeconds = BigInt(Math.floor(Date.now() / 1000));
  const nowWindowsTicks = (nowUnixSeconds + WINDOWS_EPOCH_OFFSET) * 10000000n;
  const roundedTicks = nowWindowsTicks - (nowWindowsTicks % 3000000000n);
  
  const token = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
  const data = roundedTicks.toString() + token;
  return crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function mapVoiceToEdge(voice?: string): string {
  if (!voice) return "en-US-AriaNeural";
  const v = voice.toLowerCase();
  if (v.includes("guy") || v.includes("puck") || v.includes("male")) {
    return "en-US-GuyNeural";
  }
  if (v.includes("sonia") || v.includes("gb_female")) {
    return "en-GB-SoniaNeural";
  }
  if (v.includes("ryan") || v.includes("gb_male")) {
    return "en-GB-RyanNeural";
  }
  if (v.includes("natasha") || v.includes("au_female")) {
    return "en-AU-NatashaNeural";
  }
  if (v.includes("william") || v.includes("au_male")) {
    return "en-AU-WilliamNeural";
  }
  if (voice.includes("-") && voice.endsWith("Neural")) {
    return voice;
  }
  return "en-US-AriaNeural";
}

async function synthesizeEdgeTts(text: string, voiceName: string = "en-US-AriaNeural"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reqId = uuidv32();
    const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`;
    const gec = generateSecMsGecVersion();
    
    const ws = new WebSocket(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Sec-MS-GEC': gec,
        'Sec-MS-GEC-Version': gec
      }
    });

    const audioChunks: Buffer[] = [];
    let isTerminated = false;

    const timeout = setTimeout(() => {
      if (!isTerminated) {
        isTerminated = true;
        ws.terminate();
        reject(new Error("Timeout during Edge speech synthesis"));
      }
    }, 15000);

    ws.on('open', () => {
      const date = new Date().toString();
      const configMsg = `X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"system":{"name":"SpeechSDK","version":"1.12.1-rc.1","build":"JavaScript","lang":"en-US"},"os":{"platform":"Browser","name":"Chrome","version":"120.0.0.0"}}}`;
      ws.send(configMsg);

      const contextMsg = `X-Timestamp:${date}\r\nContent-Type:application/json; charset=utf-8\r\nPath:synthesis.context\r\n\r\n{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}`;
      ws.send(contextMsg);

      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voiceName}'><rate speed='+0%' pitch='+0%'>${escapeXml(text)}</rate></voice></speak>`;
      const ssmlMsg = `X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;
      ws.send(ssmlMsg);
    });

    ws.on('message', (data, isBinary) => {
      if (isBinary) {
        try {
          const buffer = data as Buffer;
          if (buffer.length < 2) return;
          const headerLength = buffer.readUInt16BE(0);
          if (buffer.length < 2 + headerLength) return;
          const headersStr = buffer.toString('utf8', 2, 2 + headerLength);
          const audioChunk = buffer.subarray(2 + headerLength);
          if (headersStr.includes('Path:audio')) {
            audioChunks.push(audioChunk);
          }
        } catch (err) {
          console.error("Error parsing binary socket message of Edge TTS:", err);
        }
      } else {
        const textMsg = data.toString();
        if (textMsg.includes('Path:turn.end')) {
          if (!isTerminated) {
            isTerminated = true;
            clearTimeout(timeout);
            ws.close();
            resolve(Buffer.concat(audioChunks));
          }
        }
      }
    });

    ws.on('error', (err) => {
      console.error("Edge TTS WS error:", err);
      if (!isTerminated) {
        isTerminated = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    ws.on('close', () => {
      if (!isTerminated) {
        isTerminated = true;
        clearTimeout(timeout);
        if (audioChunks.length > 0) {
          resolve(Buffer.concat(audioChunks));
        } else {
          reject(new Error("Edge TTS WS connection closed prematurely with no audio"));
        }
      }
    });
  });
}

export async function runTts(args: TtsArgs): Promise<string> {
  // 1. Try free Microsoft Edge Online Neural TTS first (highly realistic, premium natural quality, 0 key required)
  try {
    const mappedVoice = mapVoiceToEdge(args.voice);
    const audioBuffer = await synthesizeEdgeTts(args.text, mappedVoice);
    return audioBuffer.toString("base64");
  } catch (err) {
    console.warn("Microsoft Edge free TTS failed, falling back to Google GenAI TTS...", err);
  }

  // 2. Fall back to original Gemini TTS config on error
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

export interface OcrArgs {
  provider: ProviderId;
  modelId: string;
  apiKey?: string;
  image: string;
}

async function runGoogleOcr(args: OcrArgs, apiKey: string): Promise<string> {
  const client = new GoogleGenAI({ apiKey, httpOptions: GOOGLE_HTTP_OPTIONS });
  const targetModel = resolveModelString(args.modelId, "google");

  const { mimeType, data } = normalizeImage(args.image);
  const response = await client.models.generateContent({
    model: targetModel,
    contents: [
      { text: "Extract all English readable text from this image exactly. Do not add any conversational intro, extra comments, or styling. Just output the clean extracted text verbatim." },
      { inlineData: { mimeType, data } }
    ],
  });

  if (!response.text) throw new Error("No text detected in the uploaded image.");
  return response.text.trim();
}

async function runOpenRouterOcr(args: OcrArgs, apiKey: string): Promise<string> {
  const targetModel = resolveModelString(args.modelId, "openrouter");
  const { full } = normalizeImage(args.image);

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
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all English readable text from this image exactly. Do not add any conversational intro, extra comments, or styling. Just output the clean extracted text verbatim." },
            { type: "image_url", image_url: { url: full } }
          ]
        }
      ],
      temperature: 0.1,
    }),
  });

  const json: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error?.message || `OpenRouter OCR failed (${res.status}).`);
  }
  const text = json?.choices?.[0]?.message?.content;
  if (!text) throw new Error("No text detected or extracted from the uploaded image via OpenRouter.");
  return text.trim();
}

export async function runOcrAnalysis(args: OcrArgs): Promise<string> {
  const apiKey = resolveApiKey(args.provider, args.apiKey);
  if (!apiKey) {
    const where = args.provider === "openrouter" ? "OpenRouter" : "Google";
    throw new Error(`Missing ${where} API key. Add one in Settings or configure it.`);
  }
  if (args.provider === "openrouter") {
    return runOpenRouterOcr(args, apiKey);
  } else {
    return runGoogleOcr(args, apiKey);
  }
}


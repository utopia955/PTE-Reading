// Shared model + provider registry for server/lambda use.
// Kept in api/_lib to avoid filesystem resolution issues on Vercel/Node ESM.

export type ProviderId = "google" | "openrouter";

export interface ProviderOption {
  id: ProviderId;
  label: string;
  /** Where the user creates a key for this provider. */
  keyUrl: string;
  /** Server env var that holds the fallback key for this provider. */
  envVar: string;
}

export interface RateLimits {
  rpm: string;
  tpm: string;
  rpd: string;
}

export interface ModelOption {
  id: string;
  label: string;
  description: string;
  /** Free-tier rate limits shown in the UI. */
  limits: RateLimits;
  /** Default model identifier on Google's Generative Language API. */
  google: string;
  /** Default model slug on OpenRouter. */
  openrouter: string;
  /** Whether the model accepts image input (required for screenshot analysis). */
  vision: boolean;
}

export const PROVIDERS: ProviderOption[] = [
  {
    id: "google",
    label: "Google AI Studio",
    keyUrl: "https://aistudio.google.com/apikey",
    envVar: "GEMINI_API_KEY",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyUrl: "https://openrouter.ai/keys",
    envVar: "OPENROUTER_API_KEY",
  },
];

export const MODELS: ModelOption[] = [
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash Lite",
    description: "Fast multimodal model. Recommended for screenshot analysis.",
    limits: { rpm: "15 RPM", tpm: "250K TPM", rpd: "500 RPD" },
    google: "gemini-3.1-flash-lite",
    openrouter: "google/gemini-3.1-flash-lite",
    vision: true,
  },
  {
    id: "gemma-4-31b",
    label: "Gemma 4 31B",
    description: "Open-weights model. Higher daily quota; best for text-heavy passages.",
    limits: { rpm: "15 RPM", tpm: "Unlimited TPM", rpd: "1.5K RPD" },
    google: "gemma-4-31b",
    openrouter: "google/gemma-4-31b",
    vision: false,
  },
];

export const DEFAULT_PROVIDER: ProviderId = "google";
export const DEFAULT_MODEL_ID = MODELS[0].id;

export function getModel(id: string | undefined | null): ModelOption {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}

export function getProvider(id: string | undefined | null): ProviderOption {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

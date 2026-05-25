// Centralised text-to-speech for the whole app.
// Strategy (always free):
//   1. Premium: Google Gemini TTS via /api/tts (high quality) when a Google key
//      is configured (user key or server env). The server returns a proper WAV.
//   2. Fallback: the browser's built-in Web Speech API (no key, works offline).

let currentAudio: HTMLAudioElement | null = null;

export function stopSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function getGoogleKey(): string {
  try {
    return (
      localStorage.getItem("google_api_key") ||
      localStorage.getItem("gemini_api_key") || // legacy key name
      ""
    );
  } catch {
    return "";
  }
}

function browserSpeak(text: string, onEnd?: () => void): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;

  // Prefer a higher-quality English voice when the platform offers one.
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /en(-|_)US/i.test(v.lang) && /Google|Natural|Online|Premium/i.test(v.name)) ||
    voices.find((v) => /en(-|_)US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang));
  if (preferred) utterance.voice = preferred;

  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
}

/** Speak `text`. Resolves immediately after playback starts; `onEnd` fires when
 *  audio finishes (or fails). Always succeeds via the Web Speech fallback. */
export async function speak(text: string, onEnd?: () => void): Promise<void> {
  stopSpeech();
  if (!text || !text.trim()) {
    onEnd?.();
    return;
  }

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, googleKey: getGoogleKey() }),
    });

    if (!res.ok) throw new Error(`tts ${res.status}`);
    const data = await res.json();
    if (!data?.audio) throw new Error("no audio");

    const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
    currentAudio = audio;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      currentAudio = null;
      onEnd?.();
    };
    audio.onended = finish;
    audio.onerror = () => {
      if (settled) return;
      settled = true;
      currentAudio = null;
      browserSpeak(text, onEnd); // decode failed → fall back
    };
    await audio.play();
  } catch {
    browserSpeak(text, onEnd);
  }
}

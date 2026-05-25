# PTE Core Reading Coach

An AI study partner for the **PTE Core Reading** section. Paste or upload
screenshots of a reading question and it returns a structured study guide:
question type, full English + Persian translation, key collocations, a
sentence-by-sentence breakdown, per-blank option analysis, grammar tips, final
answers with a confidence rating, plus flashcards/quiz tools and audio playback.

## Providers & models

Choose your provider and model in **Settings**:

| Provider | Model | Free-tier limits |
| --- | --- | --- |
| Google AI Studio / OpenRouter | **Gemini 3.1 Flash Lite** | 15 RPM, 250K TPM, 500 RPD |
| Google AI Studio / OpenRouter | **Gemma 4 31B** | 15 RPM, Unlimited TPM, 1.5K RPD |

Gemini 3.1 Flash Lite is recommended for screenshot analysis (multimodal).
Keys are stored only in your browser and sent directly to your chosen provider,
or you can configure server-side fallback keys (see below).

Text-to-speech uses Google's high-quality Gemini TTS when a Google key is
available, and automatically falls back to the browser's built-in speech engine
otherwise — so audio is always free.

## Run locally

**Prerequisite:** Node.js 18+

    npm install
    cp .env.example .env        # add at least one provider key (optional if you use in-app keys)
    npm run dev                 # http://localhost:3000

## Deploy to Vercel

1. Push this repository to GitHub/GitLab and **Import** it in Vercel.
2. Vercel auto-detects the config in `vercel.json`:
   - Build command: `npm run build` (Vite builds to `dist/`)
   - API: the Express app in `api/index.ts` runs as a serverless function and
     handles every `/api/*` route.
3. (Optional) Add environment variables in **Project, Settings, Environment
   Variables** to provide shared fallback keys:
   - `GEMINI_API_KEY`
   - `OPENROUTER_API_KEY`
   - See `.env.example` for optional model-string overrides.
4. Deploy. Users without server keys can still paste their own keys in Settings.

## Self-hosted (non-Vercel) build

    npm run build:standalone    # builds the SPA + bundles the Express server
    npm start                   # serves dist/ and the API on PORT (default 3000)

## Project structure

    api/
      index.ts        Vercel serverless entry (exports the Express app)
      _lib/
        app.ts        Express app factory (API routes only, no Vite)
        providers.ts  Google + OpenRouter analysis, Gemini TTS to WAV
        prompt.ts     Shared analysis prompt + JSON output shape
    server.ts         Local dev / standalone server (lazy-loads Vite)
    src/
      lib/models.ts   Shared provider + model registry (UI + server)
      lib/tts.ts      Client TTS (Gemini, with Web Speech fallback)
      lib/storage.ts  IndexedDB history with LocalStorage fallback
      components/      AnalysisWorkspace, CollocationsHub, Sidebar, NotesModal

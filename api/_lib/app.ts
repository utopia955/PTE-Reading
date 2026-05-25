// Express app factory holding ONLY the API routes.
// Kept free of any Vite import so it can be bundled into a Vercel serverless
// function. The local dev server (server.ts) adds Vite middleware separately.

import express, { type Express } from "express";
import { runAnalysis, runTts } from "./providers";
import { DEFAULT_MODEL_ID, DEFAULT_PROVIDER } from "./models";

export function createApiApp(): Express {
  const app = express();

  // Allow several base64 screenshots per request.
  app.use(express.json({ limit: "30mb" }));
  app.use(express.urlencoded({ extended: true, limit: "30mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      googleKey: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      openrouterKey: Boolean(process.env.OPENROUTER_API_KEY),
    });
  });

  // High-fidelity PTE Reading question analyzer.
  app.post("/api/analyze", async (req, res) => {
    try {
      const { images, model, provider, apiKey, customApiKey } = req.body || {};
      const result = await runAnalysis({
        images,
        modelId: model || DEFAULT_MODEL_ID,
        provider: provider || DEFAULT_PROVIDER,
        // `customApiKey` kept for backwards compatibility with older clients.
        apiKey: apiKey || customApiKey,
      });
      res.json(result);
    } catch (err: any) {
      console.error("PTE AI Analysis Error:", err);
      res.status(500).json({ error: err?.message || "An exception occurred inside the AI coach." });
    }
  });

  // Text-to-speech (Google only). The client falls back to Web Speech on failure.
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice, apiKey, googleKey } = req.body || {};
      if (!text) return res.status(400).json({ error: "Missing text component." });
      const audio = await runTts({ text, voice, apiKey: apiKey || googleKey });
      res.json({ audio });
    } catch (err: any) {
      const message = err?.message || "Failed to engage the text-to-speech engine.";
      // 422 = "use your client-side fallback" (no Google key configured).
      const status = message === "NO_GOOGLE_KEY" ? 422 : 500;
      if (status === 500) console.error("Oral Synthesizer Error:", err);
      res.status(status).json({ error: message });
    }
  });

  // Global Error Handler to catch express.json() errors (like PayloadTooLarge)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Global API Error:", err);
    const status = err.status || 500;
    const message = err.message || "An internal error occurred.";
    res.status(status).json({ error: message });
  });

  return app;
}

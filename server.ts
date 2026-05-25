// Local dev + self-hosted standalone server.
// On Vercel this file is NOT used — `api/index.ts` is the serverless entry and
// the static frontend is served from `dist/`. Vite is imported lazily so it is
// never pulled into a production/serverless bundle.

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createApiApp } from "./api/_lib/app";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = createApiApp();

  if (process.env.NODE_ENV !== "production") {
    // Dev: hand non-API routes to Vite (HMR-aware).
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== "true" },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Standalone production: serve the built SPA from dist/.
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PTE Core Reading Coach running on http://localhost:${PORT}`);
  });
}

startServer();

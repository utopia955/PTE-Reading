// Vercel serverless entry. The vercel.json rewrite sends every /api/* request
// here; the Express app routes them internally. No Vite is imported, so the
// function bundle stays small.

import { createApiApp } from "./_lib/app";

const app = createApiApp();

export default app;

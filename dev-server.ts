import express from "express";
import { createServer as createViteServer } from "vite";
import app from "./server.js"; // Import the production app logic

async function startDevServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });

  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Development server running on http://localhost:${PORT}`);
  });
}

startDevServer();

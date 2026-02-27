import express from "express";
import { createServer as createViteServer } from "vite";
import app from "./server.js"; 

async function startDevServer() {
  const vite = await createViteServer({
    server: { 
      middlewareMode: true,
      host: '0.0.0.0',
      port: 3000
    },
    appType: "spa",
  });

  app.use(vite.middlewares);

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Development server running on http://0.0.0.0:${PORT}`);
  });
}

startDevServer().catch(console.error);

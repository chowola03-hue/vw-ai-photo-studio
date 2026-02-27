import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("history.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    dealer TEXT,
    showroom TEXT,
    background TEXT,
    image_front TEXT,
    image_side TEXT,
    image_full TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const app = express();
app.use(express.json({ limit: '50mb' }));

// API Routes
app.post("/api/history", (req, res) => {
  const { name, dealer, showroom, background, image_front, image_side, image_full } = req.body;
  try {
    const stmt = db.prepare(`
      INSERT INTO history (name, dealer, showroom, background, image_front, image_side, image_full)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, dealer, showroom, background, image_front, image_side, image_full);
    res.json({ id: result.lastInsertRowid });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to save history" });
  }
});

app.get("/api/history", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM history ORDER BY created_at DESC").all();
    res.json(rows);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.delete("/api/history", (req, res) => {
  try {
    db.prepare("DELETE FROM history").run();
    res.json({ success: true });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to delete all history" });
  }
});

app.delete("/api/history/:id", (req, res) => {
  const { id } = req.params;
  try {
    db.prepare("DELETE FROM history WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to delete history" });
  }
});

async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }
  }
}

setupVite();

// Only listen if not running as a Vercel function
if (process.env.NODE_ENV !== "production") {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;

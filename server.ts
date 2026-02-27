import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const app = express();
app.use(express.json({ limit: '50mb' }));

// API Routes
app.post("/api/history", async (req, res) => {
  const { name, dealer, showroom, background, image_front, image_side, image_full } = req.body;
  
  if (!supabase) {
    console.warn("Supabase not configured");
    return res.status(200).json({ id: Date.now(), warning: "Supabase not configured" });
  }

  try {
    const { data, error } = await supabase
      .from('history')
      .insert([{ name, dealer, showroom, background, image_front, image_side, image_full }])
      .select();

    if (error) throw error;
    res.json({ id: data[0].id });
  } catch (error) {
    console.error("Supabase save error:", error);
    res.status(500).json({ error: "Failed to save history" });
  }
});

app.get("/api/history", async (req, res) => {
  if (!supabase) return res.json([]);

  try {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error("Supabase fetch error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.delete("/api/history/:id", async (req, res) => {
  const { id } = req.params;
  if (!supabase) return res.status(400).json({ error: "Supabase not configured" });

  try {
    const { error } = await supabase.from('history').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Supabase delete error:", error);
    res.status(500).json({ error: "Failed to delete history" });
  }
});

// Setup Vite or Static serving
async function setupApp() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    }
  }
}

setupApp();

if (process.env.NODE_ENV !== "production") {
  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

export default app;

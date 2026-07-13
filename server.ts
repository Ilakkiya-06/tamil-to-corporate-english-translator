import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parser with 50mb limit for base64 audio files
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

let aiClient: GoogleGenAI | null = null;

// Lazy initialization of the Gemini SDK client to prevent startup crashes if key is missing
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined. Please configure it in your Secrets/Environment settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// System instructions for translation expert
const systemInstruction = `You are an elite bilingual corporate communications expert and translator fluent in Tamil (both spoken/colloquial and written literary forms) and high-level corporate English.
Your job is to take Tamil speech audio or typed text, analyze it, and translate it into flawless, professional, corporate-appropriate English.

Analyze the Tamil input:
1. Identify any spoken colloquialisms, phonetic spellings, or slang (e.g., "solren" instead of "solgiren", "paiten" instead of "ponean", "vantiya" instead of "vandhittaayaa") and explain what spelling/grammar corrections are made to the base Tamil thought.
2. Translate the core message into elite professional corporate English based on the selected communication medium.

The output MUST change drastically based on the medium selected:
- 'email': Needs a full, beautifully formatted corporate email. Include a 'Subject: [Clear & Professional]' at the start. Use formal greeting, clear paragraphs, polite request/call-to-action, and professional sign-off.
- 'whatsapp': Needs a compact, highly polite but brief professional message suited for quick mobile viewing. Use spacing and minimal professional bullet points if appropriate, and include 1-2 helpful but professional emojis (e.g. 👍, 📅, ✉️) to keep it engaging yet corporate-safe.
- 'team_chat': For platforms like Slack or Microsoft Teams. Direct, clear, collaborative, friendly but strictly professional. Use markdown formatting (like bolding for key terms, lists for items) for quick scanning.

Adjust the tone of the translated text based on the requested tone:
- 'neutral': Balanced, professional, objective.
- 'polite': Exceptionally courteous, incorporating softeners (e.g., "I would be grateful if...", "Could we possibly...").
- 'assertive': Clear, direct, authoritative, confident without being aggressive.
- 'apologetic': Sincere, acknowledging mistakes gracefully, offering solutions.
- 'urgent': Expresses timeline constraints clearly, encourages prompt action professionally.
- 'gentle': Warm, supportive, empathetic and constructive.`;

// API endpoint for translation and analysis
app.post("/api/translate", async (req, res) => {
  try {
    const { text, audio, mode, tone } = req.body;
    
    // Check key before performing work
    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      return res.status(403).json({ 
        error: "GEMINI_API_KEY is not configured.", 
        details: "Please go to the Settings > Secrets menu in Google AI Studio to configure your GEMINI_API_KEY environment variable."
      });
    }

    let promptText = `Selected Communication Medium: ${mode || 'email'}\nRequested Corporate Tone: ${tone || 'neutral'}\n\n`;

    const contents: any[] = [];

    if (audio) {
      contents.push({
        inlineData: {
          mimeType: "audio/webm", // Standard captured stream in web browsers
          data: audio
        }
      });
      promptText += `The user has spoken in Tamil. Please transcribe the spoken Tamil audio accurately, analyze their Tamil words (identifying and correcting spellings, spoken colloquialisms, or slang to standard literary Tamil thoughts), and translate the message into professional corporate English according to the requested medium and tone.`;
    } else if (text) {
      promptText += `Tamil Input Text:\n"""\n${text}\n"""\n\nPlease restate the input, analyze the Tamil text (identifying any written/phonetic spellings, colloquialisms, or slang that would be corrected in a formal thought), and translate the message into professional corporate English according to the requested medium and tone.`;
    } else {
      return res.status(400).json({ error: "Either Tamil text or audio input is required to translate." });
    }

    contents.push({ text: promptText });

    // Helper with progressive exponential backoff & model fallback list for elite reliability
    const getPolishedTranslation = async () => {
      const models = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-flash-latest"];
      let lastError: any = null;

      for (const model of models) {
        let attempts = 3;
        let delay = 600;

        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            console.log(`[Translation Engine] Initiating request using model: ${model} (Trial ${attempt}/${attempts})...`);
            const response = await ai.models.generateContent({
              model,
              contents,
              config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    transcription: {
                      type: Type.STRING,
                      description: "Accurate Tamil transcription of the audio (or the original typed Tamil text if text was provided), representing the standard spelling forms of the spoken Tamil words."
                    },
                    tamilAnalysis: {
                      type: Type.STRING,
                      description: "Detailed description of spelling fixes, colloquial Tamil grammar adjustments, or specific idioms explained in standard Tamil thoughts."
                    },
                    translatedText: {
                      type: Type.STRING,
                      description: "Flawless, elite, professional English translation formatted EXACTLY for the chosen medium (Email, WhatsApp, or Team Chat) and tone."
                    },
                    translationNuances: {
                      type: Type.STRING,
                      description: "Detailed analysis of word choices, formatting decisions, and tone adjustments made to convert the Tamil sentiment into corporate English excellence."
                    }
                  },
                  required: ["transcription", "tamilAnalysis", "translatedText", "translationNuances"]
                }
              }
            });

            if (response && response.text) {
              console.log(`[Translation Engine] Success using model: ${model}`);
              return response;
            }
          } catch (err: any) {
            lastError = err;
            const errMsg = err.message || String(err);
            console.log(`[Translation Engine] Model ${model} status report (Trial ${attempt}):`, errMsg);

            // If the model is experiencing high demand (503) or rate limit (429),
            // we should not waste time retrying the same overloaded model sequentially.
            // Move to the fallback candidate immediately to prevent request timeouts.
            const isOverloaded = err.status === 503 || err.status === 429 || 
                                 errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || 
                                 errMsg.includes("429") || errMsg.includes("high demand");
            
            if (isOverloaded) {
              console.log(`[Translation Engine] Model ${model} is currently busy. Routing to next model candidate immediately.`);
              break; // Break the inner loop, proceeds to next model in outer loop
            }

            // If it is NOT a retriable error (e.g. invalid arguments/permissions), try the next model immediately
            const isRetriable = !err.status || errMsg.includes("rate") || errMsg.includes("limit") || errMsg.includes("temp");
            
            if (!isRetriable) {
              break;
            }

            if (attempt < attempts) {
              const backoff = delay + Math.floor(Math.random() * 200);
              await new Promise((r) => setTimeout(r, backoff));
              delay *= 2;
            }
          }
        }
      }
      throw lastError || new Error("All translation model candidates reported busy or returned transient API limitations.");
    };

    const response = await getPolishedTranslation();

    if (!response.text) {
      throw new Error("No response text generated by the corporate translation engine.");
    }

    const result = JSON.parse(response.text.trim());
    res.json(result);
  } catch (error: any) {
    console.error("Translation endpoint error:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during translation." });
  }
});

// API health check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

async function start() {
  // Vite dev server mounting in development, or serving static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode.`);
  });
}

start();

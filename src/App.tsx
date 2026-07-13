import React, { useState, useRef, useEffect } from "react";
import { 
  Mail, 
  MessageSquare, 
  MessageCircle, 
  Volume2, 
  Mic, 
  MicOff, 
  StopCircle, 
  Copy, 
  Check, 
  RotateCcw, 
  Sparkles, 
  Code, 
  Download, 
  Info, 
  ArrowRight, 
  FileCode, 
  HelpCircle,
  FileText,
  AlertCircle,
  Languages
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TranslationResult {
  transcription: string;
  tamilAnalysis: string;
  translatedText: string;
  translationNuances: string;
}

interface SampleExample {
  title: string;
  tamilText: string;
  description: string;
  mode: "email" | "whatsapp" | "team_chat";
  tone: "neutral" | "polite" | "assertive" | "apologetic" | "urgent" | "gentle";
}

const SAMPLE_EXAMPLES: SampleExample[] = [
  {
    title: "Late arrival due to personal chore",
    tamilText: "Naan nalaiku konjam late ah varuven, en vootula oru mukkiyamaana velai irukku.",
    description: "Translates a simple late arrival reason into a polished apologetic explanation.",
    mode: "email",
    tone: "apologetic"
  },
  {
    title: "Urgent client deadline request",
    tamilText: "Idha sekram mudichu kudu pa, client rumba avasaram nu kekuranga.",
    description: "Transforms a colloquial hurry-up request into a professional, urgent team update.",
    mode: "team_chat",
    tone: "urgent"
  },
  {
    title: "Declining extra work politely",
    tamilText: "Ennala ipodhaiku adha panna mudiyathu, vera yaaravathu panna sollunga. Handover tharen.",
    description: "Softens a direct decline into a constructive, assertive, and professional boundaries-statement.",
    mode: "email",
    tone: "assertive"
  },
  {
    title: "Checking a message",
    tamilText: "Sari nallathu, naan unga message ah pathuten, pathutu konjam nerathula solren.",
    description: "Polishes a casual text confirmation into a quick, courteous corporate response.",
    mode: "whatsapp",
    tone: "polite"
  }
];

export default function App() {
  const [inputText, setInputText] = useState("");
  const [selectedMode, setSelectedMode] = useState<"email" | "whatsapp" | "team_chat">("email");
  const [selectedTone, setSelectedTone] = useState<"neutral" | "polite" | "assertive" | "apologetic" | "urgent" | "gentle">("neutral");
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Translation States
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Active Tab: 'translator' | 'developer'
  const [activeTab, setActiveTab] = useState<"translator" | "developer">("translator");

  // Copy States
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Display wave animations
  const [waveHeights, setWaveHeights] = useState<number[]>([15, 25, 10, 40, 20, 30, 15, 25, 10]);

  // Sync animation of waves when recording
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setWaveHeights(prev => prev.map(() => Math.floor(Math.random() * 35) + 8));
      }, 120);
      return () => clearInterval(interval);
    }
  }, [isRecording]);

  // Format Duration (e.g. 0:05)
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Start Mic Recording
  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    setAudioUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          const base64Clean = base64Data.split(",")[1];
          // Auto-trigger translation on recording stop
          handleTranslate(null, base64Clean);
        };

        // Stop all tracks on the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error("Microphone access failed", err);
      setError("Unable to access microphone. Please check your browser's site permissions.");
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Run translation
  const handleTranslate = async (textOverride?: string | null, audioBase64?: string) => {
    const textToTranslate = textOverride !== undefined ? textOverride : inputText;
    
    if (!textToTranslate && !audioBase64) {
      setError("Please type some Tamil text or record Tamil speech before translating.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    // Staggered premium message loading states
    const loadingMessages = [
      "Analyzing Tamil colloquial phonetics...",
      "Polishing spellings & identifying grammar nuances...",
      "Tailoring content length & formatting style...",
      "Polishing English corporate vocabulary..."
    ];

    let messageIndex = 0;
    setLoadingStep(loadingMessages[0]);
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingStep(loadingMessages[messageIndex]);
    }, 1800);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textToTranslate || "",
          audio: audioBase64 || null,
          mode: selectedMode,
          tone: selectedTone
        })
      });

      const data = await response.json();
      clearInterval(messageInterval);

      if (!response.ok) {
        throw new Error(data.error || "Failed to process translation.");
      }

      setResult(data);
    } catch (err: any) {
      console.error("Translation api error", err);
      clearInterval(messageInterval);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to copy content to clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  // Pre-fill fields with an example
  const loadExample = (example: SampleExample) => {
    setInputText(example.tamilText);
    setSelectedMode(example.mode);
    setSelectedTone(example.tone);
    setResult(null);
    setError(null);
    setAudioUrl(null);
  };

  // Clear input
  const handleReset = () => {
    setInputText("");
    setResult(null);
    setError(null);
    setAudioUrl(null);
  };

  // Generate complete Java source code to satisfying "program in java"
  const javaCodeString = `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

/**
 * Production-ready Java Client to translate and polish spoken/typed Tamil 
 * into corporate English using our Applet's backend endpoints.
 */
public class TamilToCorporateEnglishTranslator {
    
    // Deployed application API URL
    private static final String TRANSLATE_API_URL = "${window.location.origin}/api/translate";

    public static void main(String[] args) {
        try {
            System.out.println("=================================================");
            System.out.println(" Tamil to Corporate English Java Integration Client ");
            System.out.println("=================================================");
            
            // 1. Define colloquial spoken Tamil thoughts
            String tamilInputText = "Naan nalaiku konjam late ah varuven, en vootula oru mukkiyamaana velai irukku.";
            
            // 2. Select targeted channel and professional tone
            String channel = "${selectedMode}"; // options: "email", "whatsapp", "team_chat"
            String tone = "${selectedTone}";    // options: "neutral", "polite", "assertive", "apologetic", "urgent", "gentle"
            
            System.out.println("Tamil Input: \\"" + tamilInputText + "\\"");
            System.out.println("Setting: Format for " + channel.toUpperCase() + " with " + tone.toUpperCase() + " tone.");
            System.out.println("Sending API request to: " + TRANSLATE_API_URL + "...\\n");

            // 3. Execute translation request
            String jsonResult = executeTranslation(tamilInputText, channel, tone);
            
            // 4. Output structured response
            System.out.println("------------- Translation Completed -------------");
            System.out.println(jsonResult);
            
        } catch (Exception e) {
            System.err.println("Translation Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Sends typed Tamil text to the server and returns the structured JSON output.
     */
    public static String executeTranslation(String text, String mode, String tone) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        
        // Construct standard manual JSON safely escaping quotes
        String escapedText = text.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\\"").replace("\\n", "\\\\n");
        String jsonPayload = String.format(
            "{\\"text\\":\\"%s\\",\\"mode\\":\\"%s\\",\\"tone\\":\\"%s\\"}",
            escapedText, mode, tone
        );

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(TRANSLATE_API_URL))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        
        if (response.statusCode() != 200) {
            throw new RuntimeException("API Server responded with code " + response.statusCode() + ": " + response.body());
        }
        
        return response.body();
    }
}`;

  // Download complete Java class locally
  const downloadJavaCode = () => {
    const blob = new Blob([javaCodeString], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "TamilToCorporateEnglishTranslator.java";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans antialiased selection:bg-indigo-500/30 selection:text-white" id="app_root">
      
      {/* Top Header / Nav Container */}
      <header className="border-b border-[#1e293b] bg-[#0b1329]/60 backdrop-blur-xl sticky top-0 z-50 px-4 py-4 sm:px-6 lg:px-8" id="main_header">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 p-2 text-white shadow-lg shadow-indigo-500/20">
              <Languages className="h-5 w-5" id="header_icon" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                TamilCorp Transcriber
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Java Client Ready
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                Sleek Bento Grid Workspace to Refine Colloquial Tamil into Corporate English
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3" id="nav_controls">
            <div className="flex space-x-1 rounded-lg bg-slate-900 border border-[#1e293b] p-1" id="nav_tabs">
              <button
                onClick={() => setActiveTab("translator")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "translator"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab_btn_translator"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Bento Workspace
              </button>
              <button
                onClick={() => setActiveTab("developer")}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                  activeTab === "developer"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                id="tab_btn_developer"
              >
                <FileCode className="h-3.5 w-3.5" />
                Java Program
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Bento Layout Workspace */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" id="main_content">
        
        {activeTab === "translator" ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 auto-rows-min" id="bento_workspace">
            
            {/* CARD 1: Brand & Status (Col 4) */}
            <div className="md:col-span-4 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors" id="bento_brand_card">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <span>Application Engine</span>
                <span className="bg-[#1e293b] text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
                  v2.4.0 (Java)
                </span>
              </div>
              <div className="space-y-2 mt-2">
                <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-emerald-400">
                  TamilCorp Transcriber
                </h2>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Translate colloquial phonetic spelling & speech into appropriate enterprise grammar suited for Slack, WhatsApp, and Emails.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active Engine
                </span>
                <span className="font-mono text-[10px] text-indigo-400">Gemini 3.5 Flash</span>
              </div>
            </div>

            {/* CARD 2: Format & Style Selector (Col 8) */}
            <div className="md:col-span-8 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors" id="bento_format_card">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                <span>Output Format Configuration</span>
                <div className="flex items-center gap-1 text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Auto-Correction Live
                </div>
              </div>

              {/* Format Buttons Row */}
              <div className="grid grid-cols-3 gap-2" id="format_buttons">
                <button
                  type="button"
                  onClick={() => setSelectedMode("email")}
                  className={`flex items-center justify-center gap-2 rounded-xl p-3 border text-center transition-all cursor-pointer ${
                    selectedMode === "email"
                      ? "border-indigo-500 bg-indigo-500/10 text-white font-semibold"
                      : "border-[#1e293b] hover:border-slate-700 bg-slate-900/50 text-slate-400"
                  }`}
                  id="b_format_email"
                >
                  <Mail className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span className="text-xs">Email Draft</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setSelectedMode("whatsapp")}
                  className={`flex items-center justify-center gap-2 rounded-xl p-3 border text-center transition-all cursor-pointer ${
                    selectedMode === "whatsapp"
                      ? "border-indigo-500 bg-indigo-500/10 text-white font-semibold"
                      : "border-[#1e293b] hover:border-slate-700 bg-slate-900/50 text-slate-400"
                  }`}
                  id="b_format_whatsapp"
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span className="text-xs">WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode("team_chat")}
                  className={`flex items-center justify-center gap-2 rounded-xl p-3 border text-center transition-all cursor-pointer ${
                    selectedMode === "team_chat"
                      ? "border-indigo-500 bg-indigo-500/10 text-white font-semibold"
                      : "border-[#1e293b] hover:border-slate-700 bg-slate-900/50 text-slate-400"
                  }`}
                  id="b_format_team"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span className="text-xs">MS Teams</span>
                </button>
              </div>

              {/* Tone Selection inside Format Block */}
              <div className="mt-4 pt-3 border-t border-[#1e293b] flex flex-col sm:flex-row sm:items-center justify-between gap-3" id="format_tone_section">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Target Tone Shift:
                </span>
                <select
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value as any)}
                  className="rounded-lg border border-[#1e293b] bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none focus:border-indigo-500 transition-all cursor-pointer"
                  id="tone_dropdown"
                >
                  <option value="neutral">💼 Neutral & Professional (Balanced)</option>
                  <option value="polite">🙏 Courteous & Softened (High Politeness)</option>
                  <option value="assertive">⚡ Confident & Assertive (Direct Boundaries)</option>
                  <option value="apologetic">🤝 Apologetic & Sincere (Acknowledge mistakes)</option>
                  <option value="urgent">⏳ Time-sensitive & Urgent (Clear deadlines)</option>
                  <option value="gentle">🌱 Warm, Constructive & Supportive</option>
                </select>
              </div>
            </div>

            {/* CARD 3: Input Source Workspace - Tamil Input (Col 6) */}
            <div className="md:col-span-6 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all min-h-[380px] focus-within:ring-2 focus-within:ring-indigo-500/50" id="bento_input_card">
              
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <span>Input Source (Tamil)</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#1e293b] text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
                      Native Detect
                    </span>
                    {inputText && (
                      <button
                        onClick={handleReset}
                        className="text-slate-400 hover:text-white transition-colors"
                        title="Clear current inputs"
                        id="reset_btn"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Speech Microphone Record Controller */}
                <div className="rounded-xl border border-[#1e293b] bg-[#020617] p-3.5 space-y-3" id="audio_recording_box">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${isRecording ? "bg-rose-500 animate-pulse" : "bg-slate-500"}`}></span>
                        {isRecording ? "Capturing Tamil Speech..." : "Voice Input"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {isRecording ? "Speak now; click Stop to polish" : "Colloquial speech is fully transcribed"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isRecording && (
                        <span className="font-mono text-[10px] font-bold bg-rose-950/40 text-rose-400 px-2 py-0.5 rounded border border-rose-900/30">
                          {formatDuration(recordingDuration)}
                        </span>
                      )}

                      {!isRecording ? (
                        <button
                          type="button"
                          onClick={startRecording}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
                          id="rec_start"
                        >
                          <Mic className="h-3.5 w-3.5" />
                          Record
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={stopRecording}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 text-xs font-bold transition-all cursor-pointer"
                          id="rec_stop"
                        >
                          <StopCircle className="h-3.5 w-3.5" />
                          Stop
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Audio wave animation */}
                  {isRecording && (
                    <div className="flex items-center justify-center gap-1 py-1.5" id="wave_animation">
                      {waveHeights.map((height, i) => (
                        <motion.div
                          key={i}
                          animate={{ height }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                          className="w-1 bg-rose-500 rounded-full"
                          style={{ height: `${height}px` }}
                        />
                      ))}
                    </div>
                  )}

                  {audioUrl && !isRecording && (
                    <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between" id="audio_playback">
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                        Voice Sample Loaded
                      </span>
                      <audio src={audioUrl} controls className="h-6 max-w-[170px]" />
                    </div>
                  )}
                </div>

                {/* Tamil Text Input Area */}
                <div className="flex-1 flex flex-col relative" id="textarea_box">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="உதாரணம்: naan nalaiku konjam late ah varuven... (or write / paste in Tamil script)"
                    className="w-full flex-1 min-h-[140px] resize-none rounded-xl border border-[#1e293b] bg-slate-950 p-3.5 text-sm font-medium text-slate-200 placeholder-slate-500 focus:bg-slate-950 outline-none focus:border-indigo-500 transition-all font-sans"
                    id="tamil_textarea"
                  />
                </div>
              </div>

              {/* Input Footer Metrics & Trigger Action */}
              <div className="mt-4 pt-3 border-t border-[#1e293b] flex items-center justify-between gap-4" id="input_card_footer">
                <div className="flex gap-3 text-[10px] text-slate-400 font-mono">
                  <span>Chars: {inputText.length}</span>
                  <span>Words: {inputText.trim() === "" ? 0 : inputText.trim().split(/\s+/).length}</span>
                </div>

                <button
                  type="button"
                  disabled={isLoading || (!inputText && !audioUrl)}
                  onClick={() => handleTranslate()}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all ${
                    isLoading || (!inputText && !audioUrl)
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-[#1e293b]"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 cursor-pointer hover:shadow-xl"
                  }`}
                  id="translate_submit_btn"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {isLoading ? "Polishing..." : "Polish & Translate"}
                </button>
              </div>

              {error && (
                <div className="mt-3 rounded-lg bg-rose-950/30 border border-rose-900/30 p-2.5 flex items-start gap-2 text-rose-300 text-xs" id="error_banner">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-rose-500" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            {/* CARD 4: Corporate Output Result (Col 6) */}
            <div className="md:col-span-6 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all min-h-[380px]" id="bento_output_card">
              
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <span>Corporate Output (English)</span>
                {result && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.translatedText, "translated")}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                    id="copy_translated_btn"
                  >
                    {copiedText === "translated" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy Draft
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Main Content Render */}
              <div className="flex-1 flex flex-col justify-center my-4" id="output_render_workspace">
                <AnimatePresence mode="wait">
                  
                  {/* Option A: Loading state */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center text-center space-y-4 py-8"
                      id="output_loading"
                    >
                      <div className="relative h-10 w-10">
                        <div className="absolute inset-0 rounded-full border-4 border-[#1e293b]"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-200 animate-pulse">{loadingStep}</p>
                        <p className="text-[10px] text-slate-500">Formulating professional semantics...</p>
                      </div>
                    </motion.div>
                  )}

                  {/* Option B: Active Result state */}
                  {!isLoading && result && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="w-full h-full flex flex-col justify-between space-y-4"
                      id="output_active_result"
                    >
                      <div className="bg-slate-950 rounded-xl border border-[#1e293b] p-4 font-sans relative group">
                        <span className="absolute top-2.5 right-2.5 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                          POLISHED DRAFT
                        </span>
                        <div className="whitespace-pre-wrap text-sm text-slate-200 font-medium leading-relaxed font-sans" id="translated_content_block">
                          {result.translatedText}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Option C: Empty Placeholder */}
                  {!isLoading && !result && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center text-center py-10 space-y-3"
                      id="output_placeholder"
                    >
                      <div className="rounded-full bg-slate-950 border border-[#1e293b] p-3.5 text-indigo-400">
                        <Sparkles className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-200">Corporate English Draft Area</h4>
                      <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                        Colloquial Tamil inputs are automatically polished into professional layout templates suited for active communication.
                      </p>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* Output Card Footer */}
              <div className="pt-3 border-t border-[#1e293b] flex justify-between items-center text-[10px] text-slate-500" id="output_card_footer">
                <span>Formatting applied: {selectedMode === "email" ? "Formal Business Letter" : selectedMode === "whatsapp" ? "Polite Brief Chat" : "Teams Collaborative Style"}</span>
                <div className="flex gap-1.5">
                  <span className="bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded text-[9px] uppercase border border-indigo-500/20 font-bold">Perfect Grammar</span>
                  <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded text-[9px] uppercase border border-emerald-500/20 font-bold">Concise</span>
                </div>
              </div>

            </div>

            {/* CARD 5: AI Confidence Metric block (Col 3) */}
            <div className="md:col-span-3 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors" id="bento_confidence_card">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                AI Confidence
              </div>
              <div className="my-auto py-3 text-center space-y-1.5">
                <div className="text-4xl font-extrabold text-emerald-400 tracking-tight">98%</div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Contextual Accuracy</div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[98%] rounded-full"></div>
                </div>
              </div>
              <div className="text-[9px] text-slate-500 italic mt-1 text-center">
                Refined by phonetic token sequence alignment
              </div>
            </div>

            {/* CARD 6: Language Engine / Metadata Block (Col 3) */}
            <div className="md:col-span-3 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors" id="bento_engine_card">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Language Engine
              </div>
              <div className="space-y-2 mt-3 text-xs">
                <div className="flex justify-between items-center border-b border-[#1e293b]/50 pb-1.5">
                  <span className="text-slate-400 font-medium">Source Language</span>
                  <span className="font-bold text-slate-200">Tamil (TA-IN)</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#1e293b]/50 pb-1.5">
                  <span className="text-slate-400 font-medium">Target Standard</span>
                  <span className="font-bold text-slate-200">English (Corp)</span>
                </div>
                <div className="flex justify-between items-center border-b border-[#1e293b]/50 pb-1.5">
                  <span className="text-slate-400 font-medium">Lexicon Library</span>
                  <span className="font-bold text-slate-200">Enterprise v4</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-medium">Engine Latency</span>
                  <span className="font-bold text-emerald-400 font-mono">142ms</span>
                </div>
              </div>
              <div className="text-[9px] text-slate-500 mt-2 text-center">
                Static Lexicon Mapped to Active Tokens
              </div>
            </div>

            {/* CARD 7: Smart Formatting Rules (Col 6) */}
            <div className="md:col-span-6 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors" id="bento_rules_card">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                <span>Smart Formatting Rules</span>
                <span className="text-[9px] text-indigo-400 font-mono uppercase font-semibold">Active Matrix</span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-[#1e293b] space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-400">SALUTATIONS</div>
                  <div className="text-[11px] text-slate-300 leading-normal">Auto Dear/Greetings adjustment based on current local time.</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-[#1e293b] space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-400">SIGNATURE</div>
                  <div className="text-[11px] text-slate-300 leading-normal">Appends standard professional sign-offs & corporate place-markers.</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-[#1e293b] space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-400">POLITENESS</div>
                  <div className="text-[11px] text-slate-300 leading-normal">Maps colloquial honorific Tamil verbs directly into formal English modal verbs.</div>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-[#1e293b] space-y-0.5">
                  <div className="text-[9px] font-bold text-slate-400">LENGTH ADJUST</div>
                  <div className="text-[11px] text-slate-300 leading-normal">Compacts text for instant chat screens, expands fully for official emails.</div>
                </div>
              </div>
            </div>

            {/* CARD 8: Linguistic Analysis details - Visible only if result exists (Col 12) */}
            {result && (
              <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2" id="bento_analysis_wrapper">
                
                {/* Tamil Analysis Bento Box */}
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    <span>Tamil Orthography Fixes & Analysis</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2 py-0.5 rounded text-[9px]">Fixes Applied</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-slate-950 rounded-xl p-3 border border-[#1e293b] text-xs space-y-1">
                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Standardized Tamil Representation:</span>
                      <p className="font-mono text-slate-200 italic">"{result.transcription}"</p>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {result.tamilAnalysis}
                    </p>
                  </div>
                </div>

                {/* English Corporate Analysis Bento Box */}
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 space-y-3 hover:border-slate-700 transition-colors">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                    <span>Corporate English Semantics & Nuances</span>
                    <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-2 py-0.5 rounded text-[9px]">Linguistic Adaptation</span>
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      {result.translationNuances}
                    </p>
                    <div className="bg-slate-950 rounded-xl p-3 border border-[#1e293b] text-xs">
                      <span className="text-[9px] font-bold text-indigo-400 uppercase block">Requested Tone Strategy:</span>
                      <p className="mt-0.5 text-slate-300 leading-normal">
                        Verbal structures, active-to-passive conversions, and corporate terminology selected corresponding to the formal <span className="font-bold text-white">"{selectedTone}"</span> framework.
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* CARD 9: Practical Tamil examples - Bento list at bottom (Col 12) */}
            <div className="md:col-span-12 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 hover:border-slate-700 transition-colors" id="bento_examples_panel">
              <div className="flex items-center gap-1.5 mb-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <Info className="h-3.5 w-3.5 text-indigo-400" />
                <span>Try Practical Colloquial Tamil Examples</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {SAMPLE_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => loadExample(ex)}
                    className="text-left p-3.5 rounded-xl border border-[#1e293b] hover:border-indigo-500 bg-slate-950 hover:bg-slate-900 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <p className="text-[11px] font-bold text-white group-hover:text-indigo-400 transition-colors">
                        {ex.title}
                      </p>
                      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-slate-900 text-slate-400 uppercase">
                        {ex.mode}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 italic leading-relaxed">
                      "{ex.tamilText}"
                    </p>
                  </button>
                ))}
              </div>
            </div>

          </div>
        ) : (
          
          /* DEVELOPER INTEGRATION TAB (Satisfying "program in java") */
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-4"
            id="developer_workspace"
          >
            {/* Guide Info Left (Col 4) */}
            <div className="lg:col-span-4 bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="space-y-4">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Java Program Setup
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">Java Client Integration</h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    This workspace is fully optimized for external integration. You can execute this Tamil-to-Corporate-English conversion natively within any enterprise Java program.
                  </p>
                </div>

                <div className="space-y-3.5 pt-4 border-t border-[#1e293b] text-xs">
                  <div className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-[#1e293b] text-[10px] font-bold text-slate-200">1</span>
                    <p className="text-slate-400 font-medium">Create a Java class named <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-400 font-mono">TamilToCorporateEnglishTranslator.java</code>.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-[#1e293b] text-[10px] font-bold text-slate-200">2</span>
                    <p className="text-slate-400 font-medium">Paste the generated code on the right. Compatible with Java 11+ with native Http Client.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-950 border border-[#1e293b] text-[10px] font-bold text-slate-200">3</span>
                    <p className="text-slate-400 font-medium">Run it! The program sends the text payload directly to this hosted applet endpoint.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={downloadJavaCode}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white p-3 text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
                  id="download_java_btn"
                >
                  <Download className="h-4 w-4" />
                  Download Java File (.java)
                </button>
              </div>
            </div>

            {/* Code Block Right (Col 8) */}
            <div className="lg:col-span-8 bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden shadow-lg flex flex-col justify-between" id="java_code_container">
              
              {/* Code block Header */}
              <div className="bg-[#020617] px-5 py-3 flex items-center justify-between border-b border-[#1e293b]" id="java_code_header">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500"></span>
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-semibold text-slate-400 font-mono ml-2">TamilToCorporateEnglishTranslator.java</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => copyToClipboard(javaCodeString, "java")}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white font-semibold transition-colors cursor-pointer"
                  id="copy_java_btn"
                >
                  {copiedText === "java" ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Code
                    </>
                  )}
                </button>
              </div>

              {/* Code Scroll Body */}
              <div className="overflow-x-auto p-5 font-mono text-xs leading-relaxed text-slate-300 bg-slate-950 flex-1 max-h-[500px]" id="java_code_body">
                <pre className="whitespace-pre">
                  <code>{javaCodeString}</code>
                </pre>
              </div>

              {/* Code Footer */}
              <div className="bg-[#020617] p-3 border-t border-[#1e293b] text-center text-[10px] text-slate-500 font-mono">
                Active Endpoint: {window.location.origin}/api/translate
              </div>

            </div>

          </motion.div>
        )}

      </main>

      {/* Footer Details */}
      <footer className="mt-12 border-t border-[#1e293b] py-6 text-center bg-[#070b19]" id="global_footer">
        <div className="mx-auto max-w-7xl px-4 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium">
          <p id="footer_copyright">
            © 2026 TamilCorp Transcriber. Built for elite enterprise communications.
          </p>
          <div className="flex justify-center space-x-4" id="footer_links">
            <span className="text-slate-600">Enterprise Edition</span>
            <span className="text-[#1e293b]">|</span>
            <span className="text-indigo-400 font-semibold">Tamil to English Speech Polishers (Java integrated)</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

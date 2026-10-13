"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AudioLines, Bot, Brain, Camera, ImagePlus, MessageCircle, Mic, MicOff, Plus, RotateCcw, Send, Sparkles, UserRound, X } from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui";

const suggestions = [
  "How do I report a road concern?",
  "What services does the LGU offer?",
  "How can I follow my report?",
];

const welcomeMessage = "Hi! I’m ServeLink, your community assistant. Ask me about using ServeLink or finding municipal services in Tupi.";

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
  imagePreview?: string;
};

type ChatImage = {
  mimeType: "image/jpeg";
  data: string;
  preview: string;
};

type GeminiMessage = {
  role: "user" | "model";
  text: string;
  image?: Pick<ChatImage, "mimeType" | "data">;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const MAX_SOURCE_IMAGE_SIZE = 12 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_SIZE = 4 * 1024 * 1024;

async function prepareChatImage(file: File): Promise<ChatImage> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_SOURCE_IMAGE_SIZE) {
    throw new Error("Choose an image smaller than 12 MB.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be opened. Try another photo.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser could not prepare this image. Try another browser.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  if (!blob) throw new Error("Your browser could not prepare this image. Try another photo.");
  if (blob.size > MAX_COMPRESSED_IMAGE_SIZE) {
    throw new Error("This image is still too large after resizing. Please choose a smaller photo.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The image could not be read."));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
  const data = dataUrl.split(",")[1];
  if (!data) throw new Error("The image could not be prepared for sending.");
  return { mimeType: "image/jpeg", data, preview: dataUrl };
}

export function CommunityChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: welcomeMessage }]);
  const [history, setHistory] = useState<GeminiMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [selectedImage, setSelectedImage] = useState<ChatImage | null>(null);
  const [failedMessage, setFailedMessage] = useState<{ prompt: string; image: ChatImage | null; thinkingMode: boolean } | null>(null);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatAccess, setChatAccess] = useState<"checking" | "allowed" | "guest" | "error">("checking");
  const conversationRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) throw new Error("Your sign-in status could not be checked.");
      const result = await response.json() as { user?: unknown };
      if (active) setChatAccess(result.user ? "allowed" : "guest");
    }).catch(() => {
      if (active) setChatAccess("error");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function requireAccount() {
    let access = chatAccess;
    if (access === "checking") {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) throw new Error("Your sign-in status could not be checked.");
        const result = await response.json() as { user?: unknown };
        access = result.user ? "allowed" : "guest";
        setChatAccess(access);
      } catch {
        setChatAccess("error");
        access = "error";
      }
    }
    if (access === "allowed") return true;
    if (access === "guest") {
      window.location.assign("/login?returnTo=%2F");
    } else {
      setError("ServeLink could not verify your account. Refresh the page and try again.");
    }
    return false;
  }

  async function selectImage(file?: File) {
    if (!await requireAccount()) return;
    if (!file) return;
    setImageError("");
    try {
      setSelectedImage(await prepareChatImage(file));
    } catch (selectionError) {
      setImageError(selectionError instanceof Error ? selectionError.message : "The image could not be prepared.");
    }
  }

  async function sendMessage(
    event?: FormEvent<HTMLFormElement>,
    suggestion?: string,
    retrying = false,
    retryImage: ChatImage | null = null,
    retryThinkingMode = thinkingMode,
  ) {
    event?.preventDefault();
    if (!await requireAccount()) return;
    const typedPrompt = (suggestion ?? question).trim();
    const attachment = retrying ? retryImage : selectedImage;
    if ((!typedPrompt && !attachment) || loading) return;
    const prompt = typedPrompt || "Please describe this image and help me understand it.";

    setQuestion("");
    setError("");
    setFailedMessage(null);
    if (!retrying) {
      setSelectedImage(null);
      setAttachmentMenuOpen(false);
      setMessages((current) => [...current, { role: "user", text: prompt, imagePreview: attachment?.preview }]);
    }
    setLoading(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: prompt,
          history: attachment
            ? history.map(({ role, text }) => ({ role, text }))
            : history,
          ...(attachment ? { image: { mimeType: attachment.mimeType, data: attachment.data } } : {}),
          thinkingMode: retrying ? retryThinkingMode : thinkingMode,
        }),
      });
      const data = await response.json() as { answer?: unknown; error?: unknown };
      if (!response.ok) {
        if (response.status === 401) {
          setChatAccess("guest");
          window.location.assign("/login?returnTo=%2F");
          return;
        }
        throw new Error(typeof data.error === "string" ? data.error : "The assistant could not respond.");
      }
      if (typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error("The assistant returned an empty response. Please try again.");
      }

      const answer = data.answer.trim();
      setMessages((current) => [...current, { role: "assistant", text: answer }]);
      const previousHistory = attachment
        ? history.map(({ role, text }) => ({ role, text }))
        : history;
      const completedTurn: GeminiMessage[] = [
        ...previousHistory,
        { role: "user", text: prompt, ...(attachment ? { image: { mimeType: attachment.mimeType, data: attachment.data } } : {}) },
        { role: "model", text: answer },
      ];
      setHistory(completedTurn.slice(-12));
      setFailedMessage(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The assistant could not respond. Please try again.");
      setFailedMessage({ prompt, image: attachment, thinkingMode: retrying ? retryThinkingMode : thinkingMode });
    } finally {
      setLoading(false);
    }
  }

  async function toggleVoiceInput() {
    if (!await requireAccount()) return;
    if (recording) {
      speechRecognitionRef.current?.stop();
      return;
    }
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("Voice input is not supported in this browser. Try Chrome or Edge, or type your message.");
      return;
    }

    setVoiceError("");
    const recognition = new Recognition();
    recognition.lang = "en-PH";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[event.resultIndex]?.[0]?.transcript?.trim();
      if (transcript) setQuestion((current) => `${current}${current.trim() ? " " : ""}${transcript}`);
    };
    recognition.onerror = (event) => {
      setVoiceError(event.error === "not-allowed"
        ? "Microphone access was denied. Allow microphone access in your browser settings and try again."
        : "Voice input could not start. Check your microphone and try again.");
    };
    recognition.onend = () => {
      setRecording(false);
      speechRecognitionRef.current = null;
    };
    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
    } catch {
      speechRecognitionRef.current = null;
      setRecording(false);
      setVoiceError("Voice input could not start. Check your microphone and try again.");
    }
  }

  useEffect(() => () => speechRecognitionRef.current?.stop(), []);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function startNewChat() {
    setMessages([{ role: "assistant", text: welcomeMessage }]);
    setHistory([]);
    setQuestion("");
    setError("");
    setImageError("");
    setSelectedImage(null);
    setFailedMessage(null);
    setThinkingMode(false);
    setVoiceError("");
  }

  async function toggleAttachmentMenu() {
    if (await requireAccount()) setAttachmentMenuOpen((open) => !open);
  }

  async function toggleThinkingMode() {
    if (await requireAccount()) setThinkingMode((enabled) => !enabled);
  }

  return (
    <Card className="mx-auto mt-9 max-w-2xl overflow-hidden text-left shadow-[0_20px_70px_rgba(28,85,104,.13)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0d9b91]/10 text-[#0d9b91]">
            <span className="absolute inset-0 rounded-2xl bg-[#0d9b91]/15 motion-safe:animate-ping" />
            <Bot size={21} className="relative motion-safe:animate-pulse" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Chat with ServeLink</h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted)]"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span> Gemini community assistant · Live</p>
          </div>
        </div>
        {history.length > 0 && (
          <Button type="button" variant="ghost" onClick={startNewChat} className="min-h-9 gap-1.5 px-2 text-xs" aria-label="Start a new chat">
            <RotateCcw size={14} /> <span className="hidden sm:inline">New chat</span>
          </Button>
        )}
      </div>

      <div ref={conversationRef} aria-label="Chat messages" aria-live="polite" className="max-h-[360px] min-h-48 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.map((message, index) => (
          <div key={`${index}-${message.role}`} className={`flex items-end gap-2.5 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            {message.role === "assistant" && <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9b91]/10 text-[#0d9b91]"><Bot size={15} className="motion-safe:animate-pulse" /></span>}
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#12365a] text-white dark:bg-[#a8d1ff] dark:text-[#10253b]" : "rounded-bl-md bg-[var(--background)] text-[var(--foreground)]"}`}>
              {message.imagePreview && <img src={message.imagePreview} alt="Photo sent to ServeLink" className="mb-2 max-h-52 max-w-full rounded-xl object-contain" />}
              {message.text}
            </div>
            {message.role === "user" && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"><UserRound size={15} /></span>}
          </div>
        ))}
        {loading && (
          <div role="status" className="flex items-end gap-2.5">
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9b91]/10 text-[#0d9b91]"><Bot size={15} className="motion-safe:animate-pulse" /></span>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted)]">
              <span className="flex gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d9b91]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d9b91] [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d9b91] [animation-delay:240ms]" /></span>
              {selectedImage || messages[messages.length - 1]?.imagePreview ? "ServeLink is reviewing the photo…" : "ServeLink is typing"}
            </div>
          </div>
        )}
      </div>

      {history.length === 0 && !loading && (
        <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5">
          {suggestions.map((item) => (
            <button key={item} type="button" onClick={() => void sendMessage(undefined, item)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-[#0d9b91]/50 hover:bg-[var(--accent-soft)] hover:text-[#08776f]">
              {item}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div role="alert" className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:mx-5">
          <p>{error}</p>
          {failedMessage && <button type="button" onClick={() => void sendMessage(undefined, failedMessage.prompt, true, failedMessage.image, failedMessage.thinkingMode)} className="mt-1 font-semibold underline underline-offset-2">Retry this message</button>}
        </div>
      )}

      <form onSubmit={(event) => void sendMessage(event)} className="border-t border-[var(--line)] p-3 sm:p-4">
        {selectedImage && (
          <div className="mb-3 inline-flex items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--background)] p-2">
            <img src={selectedImage.preview} alt="Selected photo preview" className="h-16 w-16 rounded-lg object-cover" />
            <span className="pt-1 text-xs text-[var(--muted)]">Photo ready to send</span>
            <button type="button" aria-label="Remove selected photo" onClick={() => setSelectedImage(null)} className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600"><X size={15} /></button>
          </div>
        )}
        {imageError && <p role="alert" className="mb-2 text-xs text-rose-600">{imageError}</p>}
        <input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={loading} onChange={(event) => { void selectImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={loading} onChange={(event) => { void selectImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        {voiceError && <p role="alert" className="mb-2 text-xs text-rose-600">{voiceError}</p>}
        <div className="relative flex min-h-[58px] items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-[0_4px_20px_rgba(15,23,42,.06)] transition focus-within:border-[#0d9b91]/40 focus-within:shadow-[0_4px_24px_rgba(13,155,145,.12)] dark:border-[var(--line)] dark:bg-[var(--surface)]">
          <button type="button" onClick={() => void toggleAttachmentMenu()} disabled={loading} aria-label="Add attachment" aria-expanded={attachmentMenuOpen} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground)] transition hover:bg-[var(--background)] disabled:opacity-50"><Plus size={23} /></button>
          {attachmentMenuOpen && (
            <div className="absolute bottom-full left-2 z-10 mb-2 w-48 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-xl">
              <button type="button" onClick={() => { setAttachmentMenuOpen(false); uploadInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-[var(--background)]"><ImagePlus size={17} className="text-[#0d9b91]" /> Upload an image</button>
              <button type="button" onClick={() => { setAttachmentMenuOpen(false); cameraInputRef.current?.click(); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-[var(--background)]"><Camera size={17} className="text-[#0d9b91]" /> Take a picture</button>
            </div>
          )}
          <Textarea
            aria-label="Message the ServeLink assistant"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ServeLink"
            className="min-h-10 max-h-28 min-w-0 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus:border-0 focus:ring-0"
            maxLength={1000}
            rows={1}
            disabled={loading}
          />
          <button type="button" onClick={() => void toggleThinkingMode()} aria-label="Toggle Think mode" aria-pressed={thinkingMode} title="Toggle Think mode" className={`flex min-h-9 shrink-0 items-center gap-2 rounded-full px-2 text-sm transition sm:px-3 ${thinkingMode ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200" : "text-slate-500 hover:bg-[var(--background)]"}`}><Brain size={18} /><span className="hidden sm:inline">Think</span></button>
          <button type="button" onClick={() => void toggleVoiceInput()} disabled={loading} aria-label={recording ? "Stop voice input" : "Start voice input"} title={recording ? "Stop voice input" : "Speak your message"} aria-pressed={recording} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${recording ? "bg-rose-50 text-rose-600 motion-safe:animate-pulse dark:bg-rose-950" : "text-[var(--foreground)] hover:bg-[var(--background)]"}`}>
            {recording ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
          <Button type="submit" loading={loading} disabled={!question.trim() && !selectedImage} aria-label="Send message" className="h-11 min-h-11 w-11 shrink-0 rounded-full bg-[#4f76e8] p-0 text-white hover:bg-[#3f64d5] dark:bg-[#4f76e8] dark:text-white">
            {loading ? null : question.trim() || selectedImage ? <Send size={18} /> : <AudioLines size={21} />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1"><Sparkles size={12} /> Voice is transcribed by your browser; photos are sent to Gemini.</span>
          <span className="hidden sm:inline"><MessageCircle size={12} className="inline" /> {recording ? "Listening…" : "Enter to send"}</span>
        </div>
        {chatAccess === "guest" && <p className="mt-2 text-center text-xs text-[var(--muted)]"><a href="/login?returnTo=%2F" className="font-semibold text-[#0d9b91] hover:underline">Sign in or sign up to chat with ServeLink</a></p>}
      </form>
    </Card>
  );
}

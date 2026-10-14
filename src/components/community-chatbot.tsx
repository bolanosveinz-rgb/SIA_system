"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { AudioLines, Bot, Brain, Camera, Clock3, ImagePlus, Mic, MicOff, Plus, RotateCcw, Send, UserRound, X } from "lucide-react";
import { Button, Card, Textarea } from "@/components/ui";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<GeminiMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [showRetryGuidance, setShowRetryGuidance] = useState(false);
  const [imageError, setImageError] = useState("");
  const [selectedImage, setSelectedImage] = useState<ChatImage | null>(null);
  const [failedMessage, setFailedMessage] = useState<{ prompt: string; image: ChatImage | null; thinkingMode: boolean } | null>(null);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatAccess, setChatAccess] = useState<"checking" | "allowed" | "guest" | "error">("checking");
  const [open, setOpen] = useState(false);
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
    if (access === "allowed") {
      setOpen(true);
      return true;
    }
    if (access === "guest") {
      window.location.assign("/login?returnTo=%2F");
    } else {
      setError("ServeLink could not verify your account. Refresh the page and try again.");
      setOpen(true);
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
    setShowRetryGuidance(false);
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
      setShowRetryGuidance(false);
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
    setMessages([]);
    setHistory([]);
    setQuestion("");
    setError("");
    setShowRetryGuidance(false);
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

  const hasRetryGuidance = error.toLowerCase().includes("temporarily unavailable")
    || error.toLowerCase().includes("quota")
    || error.toLowerCase().includes("did not respond within");

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6">
      <div className="relative mx-auto w-full max-w-5xl">
        {open && (messages.length > 0 || error) && <Card className="absolute inset-x-0 bottom-full mb-3 overflow-hidden text-left shadow-[0_20px_70px_rgba(28,85,104,.2)]">
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
            <div className="flex items-center gap-1">
              {history.length > 0 && <Button type="button" variant="ghost" onClick={startNewChat} className="min-h-9 gap-1.5 px-2 text-xs" aria-label="Start a new chat"><RotateCcw size={14} /> <span className="hidden sm:inline">New chat</span></Button>}
              <button type="button" onClick={() => { setOpen(false); setAttachmentMenuOpen(false); }} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"><X size={18} /></button>
            </div>
          </div>

          <div ref={conversationRef} aria-label="Chat messages" aria-live="polite" className="max-h-[min(42vh,360px)] min-h-32 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
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
            {loading && <div role="status" className="flex items-end gap-2.5">
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9b91]/10 text-[#0d9b91]"><Bot size={15} className="motion-safe:animate-pulse" /></span>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-[var(--background)] px-4 py-3 text-sm text-[var(--muted)]">
                <span className="flex gap-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d9b91]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d9b91] [animation-delay:120ms]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#0d9b91] [animation-delay:240ms]" /></span>
                {selectedImage || messages[messages.length - 1]?.imagePreview ? "ServeLink is reviewing the photo…" : "ServeLink is typing"}
              </div>
            </div>}
          </div>

          {error && <div role="alert" className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 sm:mx-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"><Clock3 size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{error.toLowerCase().includes("did not respond within") ? "Google Gemini is taking longer than expected" : "The assistant couldn’t connect to Google Gemini"}</p>
                <p className="mt-1 leading-5">{error}</p>
                {showRetryGuidance && <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs leading-5 text-amber-950 dark:bg-black/20 dark:text-amber-100">{error.toLowerCase().includes("quota") ? "Google does not provide an exact reset time here. Check your project’s quota in Google AI Studio; once it resets, you can retry this message." : error.toLowerCase().includes("did not respond within") ? "The request reached its 120-second wait limit. Google may be responding slowly, so an exact recovery time is not available. Retry shortly; if it happens again, simplify your question or attach a smaller photo." : "There’s no guaranteed recovery time because this delay is on Google’s side. Wait a few minutes before retrying. If it keeps happening, check Google AI Studio service status and try again later."}</p>}
                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                  {hasRetryGuidance && <button type="button" onClick={() => setShowRetryGuidance((visible) => !visible)} aria-expanded={showRetryGuidance} className="text-xs font-semibold underline decoration-amber-500/50 underline-offset-4 hover:decoration-amber-700">{showRetryGuidance ? "Hide wait guidance" : error.toLowerCase().includes("did not respond within") ? "Why is this taking so long?" : "How long should I wait?"}</button>}
                  {failedMessage && <button type="button" onClick={() => void sendMessage(undefined, failedMessage.prompt, true, failedMessage.image, failedMessage.thinkingMode)} className="text-xs font-bold underline decoration-amber-600/50 underline-offset-4 hover:decoration-amber-800">Retry this message</button>}
                </div>
              </div>
            </div>
          </div>}
        </Card>}
        <form onSubmit={(event) => void sendMessage(event)} onClick={() => setOpen(true)} onFocusCapture={() => setOpen(true)} className="relative rounded-full border border-slate-200 bg-white p-2 shadow-[0_8px_32px_rgba(15,23,42,.16)] transition focus-within:border-[#0d9b91]/50 focus-within:shadow-[0_8px_36px_rgba(13,155,145,.2)] dark:border-[var(--line)] dark:bg-[var(--surface)]">
        {open && selectedImage && (
          <div className="mb-2 ml-2 inline-flex items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--background)] p-2">
            <img src={selectedImage.preview} alt="Selected photo preview" className="h-16 w-16 rounded-lg object-cover" />
            <span className="pt-1 text-xs text-[var(--muted)]">Photo ready to send</span>
            <button type="button" aria-label="Remove selected photo" onClick={() => setSelectedImage(null)} className="rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-rose-600"><X size={15} /></button>
          </div>
        )}
        {open && (imageError || voiceError) && <p role="alert" className="mb-2 px-3 pt-2 text-xs text-rose-600">{imageError || voiceError}</p>}
        <input ref={uploadInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={loading} onChange={(event) => { void selectImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={loading} onChange={(event) => { void selectImage(event.target.files?.[0]); event.currentTarget.value = ""; }} />
        <div className="relative flex min-h-[52px] items-center gap-1.5 px-1 sm:min-h-[58px] sm:gap-2 sm:px-2">
          <button type="button" onClick={() => void toggleAttachmentMenu()} disabled={loading} aria-label={selectedImage ? "Add attachment, photo selected" : "Add attachment"} aria-expanded={attachmentMenuOpen} className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--foreground)] transition hover:bg-[var(--background)] disabled:opacity-50 sm:h-10 sm:w-10"><Plus size={23} />{selectedImage && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#0d9b91]" />}</button>
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
            className="min-h-10 max-h-28 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base shadow-none focus:border-0 focus:ring-0"
            rows={1}
            disabled={loading}
          />
          <button type="button" onClick={() => void toggleThinkingMode()} aria-label="Toggle Think mode" aria-pressed={thinkingMode} title="Toggle Think mode" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm transition sm:h-10 sm:w-auto sm:gap-2 sm:px-3 ${thinkingMode ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200" : "text-slate-500 hover:bg-[var(--background)]"}`}><Brain size={18} /><span className="hidden sm:inline">Think</span></button>
          <button type="button" onClick={() => void toggleVoiceInput()} disabled={loading} aria-label={recording ? "Stop voice input" : "Start voice input"} title={recording ? "Stop voice input" : "Speak your message"} aria-pressed={recording} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 sm:h-10 sm:w-10 ${recording ? "bg-rose-50 text-rose-600 motion-safe:animate-pulse dark:bg-rose-950" : "text-[var(--foreground)] hover:bg-[var(--background)]"}`}>
            {recording ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
          <Button type="submit" loading={loading} disabled={!question.trim() && !selectedImage} aria-label="Send message" className="h-10 min-h-10 w-10 shrink-0 rounded-full bg-[#4f76e8] p-0 text-white hover:bg-[#3f64d5] dark:bg-[#4f76e8] dark:text-white sm:h-11 sm:min-h-11 sm:w-11">
            {loading ? null : question.trim() || selectedImage ? <Send size={18} /> : <AudioLines size={21} />}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}

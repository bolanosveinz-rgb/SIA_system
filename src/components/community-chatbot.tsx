"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, Camera, ImagePlus, MessageCircle, RotateCcw, Send, Sparkles, UserRound, X } from "lucide-react";
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
  const [failedMessage, setFailedMessage] = useState<{ prompt: string; image: ChatImage | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const conversationRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function selectImage(file?: File) {
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
  ) {
    event?.preventDefault();
    const typedPrompt = (suggestion ?? question).trim();
    const attachment = retrying ? retryImage : selectedImage;
    if ((!typedPrompt && !attachment) || loading) return;
    const prompt = typedPrompt || "Please describe this image and help me understand it.";

    setQuestion("");
    setError("");
    setFailedMessage(null);
    if (!retrying) {
      setSelectedImage(null);
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
        }),
      });
      const data = await response.json() as { answer?: unknown; error?: unknown };
      if (!response.ok) {
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
      setFailedMessage({ prompt, image: attachment });
    } finally {
      setLoading(false);
    }
  }

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
  }

  return (
    <Card className="mx-auto mt-9 max-w-2xl overflow-hidden text-left shadow-[0_20px_70px_rgba(28,85,104,.13)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0d9b91]/10 text-[#0d9b91]"><Bot size={21} /></span>
          <div>
            <h2 className="text-sm font-bold">Chat with ServeLink</h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--muted)]"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Gemini community assistant</p>
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
            {message.role === "assistant" && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9b91]/10 text-[#0d9b91]"><Bot size={15} /></span>}
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#12365a] text-white dark:bg-[#a8d1ff] dark:text-[#10253b]" : "rounded-bl-md bg-[var(--background)] text-[var(--foreground)]"}`}>
              {message.imagePreview && <img src={message.imagePreview} alt="Photo sent to ServeLink" className="mb-2 max-h-52 max-w-full rounded-xl object-contain" />}
              {message.text}
            </div>
            {message.role === "user" && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"><UserRound size={15} /></span>}
          </div>
        ))}
        {loading && (
          <div role="status" className="flex items-end gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0d9b91]/10 text-[#0d9b91]"><Bot size={15} /></span>
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
          {failedMessage && <button type="button" onClick={() => void sendMessage(undefined, failedMessage.prompt, true, failedMessage.image)} className="mt-1 font-semibold underline underline-offset-2">Retry this message</button>}
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
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--line)] bg-[var(--background)] p-2 transition focus-within:border-[#0d9b91]/50 focus-within:ring-4 focus-within:ring-[#0d9b91]/10">
          <button type="button" onClick={() => uploadInputRef.current?.click()} disabled={loading} aria-label="Upload an image" title="Upload an image" className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[#08776f] disabled:opacity-50"><ImagePlus size={18} /></button>
          <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={loading} aria-label="Take a picture" title="Take a picture" className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[#08776f] disabled:opacity-50"><Camera size={18} /></button>
          <Textarea
            aria-label="Message the ServeLink assistant"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up or start a conversation…"
            className="min-h-11 max-h-32 resize-y border-0 bg-transparent px-2 py-2 text-sm shadow-none focus:border-0 focus:ring-0"
            maxLength={1000}
            rows={2}
            disabled={loading}
          />
          <Button type="submit" loading={loading} disabled={!question.trim() && !selectedImage} aria-label="Send message" className="mb-0.5 h-10 min-h-10 w-10 shrink-0 rounded-xl px-0">
            {loading ? null : <Send size={17} />}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1"><Sparkles size={12} /> Photos are sent to Gemini for analysis. Confirm official or urgent information with the Municipality of Tupi.</span>
          <span className="hidden sm:inline"><MessageCircle size={12} className="inline" /> Enter to send</span>
        </div>
      </form>
    </Card>
  );
}

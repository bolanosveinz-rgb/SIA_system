"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Heart, Maximize, MessageCircle, Pause, Play, Send, Volume2, VolumeX, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input } from "@/components/ui";

type Media = { id: string; url: string; type: "IMAGE" | "VIDEO" };
type Comment = { id: string; body: string; createdAt: string; user: { name: string; residentProfile: { profilePhotoUrl: string | null } | null } };
type Post = {
  id: string;
  caption: string;
  createdAt: string;
  media: Media[];
  author: { name: string; adminProfile: { profilePhotoUrl: string | null } | null };
  _count: { likes: number; comments: number };
  liked: boolean;
};

function cloudinaryVideoUrl(url: string, transformation: string, extension: "jpg" | "mp4") {
  const uploadPath = "/video/upload/";
  const uploadIndex = url.indexOf(uploadPath);
  if (uploadIndex === -1) return url;
  const transformed = `${url.slice(0, uploadIndex + uploadPath.length)}${transformation}/${url.slice(uploadIndex + uploadPath.length)}`;
  return transformed.replace(/\.(?:mp4|mov|webm)(?=$|\?)/i, `.${extension}`);
}

function NewsVideo({ media, index }: { media: Media; index: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  useEffect(() => () => {
    if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
  }, []);

  function revealControls() {
    setControlsVisible(true);
    if (controlsTimerRef.current !== null) window.clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = window.setTimeout(() => setControlsVisible(false), 3000);
  }

  async function playVideo() {
    try {
      if (videoRef.current?.paused) await videoRef.current.play();
      else videoRef.current?.pause();
    } catch {
      toast.error("This video could not be played. Please try again.");
    }
  }

  function retryVideo() {
    setFailed(false);
    videoRef.current?.load();
    void playVideo();
  }

  function toggleFullscreen() {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void video.parentElement?.requestFullscreen();
  }

  return <div
    className="group relative aspect-[16/9] overflow-hidden bg-black"
    onPointerMove={revealControls}
    onPointerLeave={revealControls}
    onTouchStart={revealControls}
    onFocusCapture={revealControls}
  >
    <video
      ref={videoRef}
      playsInline
      preload="metadata"
      poster={cloudinaryVideoUrl(media.url, "so_0,f_jpg", "jpg")}
      className="h-full w-full object-contain"
      aria-label={`Community announcement video ${index + 1}`}
      onPlay={() => { setPlaying(true); setFailed(false); }}
      onPause={() => setPlaying(false)}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
      onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      onError={() => setFailed(true)}
      onClick={() => { revealControls(); void playVideo(); }}
    >
      <source src={cloudinaryVideoUrl(media.url, "f_mp4", "mp4")} type="video/mp4" />
    </video>
    {!playing && !failed && <button
      type="button"
      onClick={(event) => { event.stopPropagation(); revealControls(); void playVideo(); }}
      aria-label={`Play community announcement video ${index + 1}`}
      className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-lg ring-2 ring-white/80 transition hover:scale-105 hover:bg-[#0d9b91] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0d9b91]"
    >
      <Play size={28} fill="currentColor" className="ml-1" />
    </button>}
    {!failed && <div className={`absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-3 pb-3 pt-10 text-white transition-opacity duration-200 ${controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}>
      <button type="button" onClick={() => { revealControls(); void playVideo(); }} aria-label={playing ? "Pause video" : "Play video"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
      <span className="min-w-10 text-xs tabular-nums">{formatVideoTime(currentTime)}</span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        aria-label="Seek video"
        onChange={(event) => {
          if (videoRef.current) videoRef.current.currentTime = Number(event.currentTarget.value);
          revealControls();
        }}
        className="h-1 min-w-0 flex-1 cursor-pointer accent-[#35c8b6]"
      />
      <span className="min-w-10 text-xs tabular-nums">{formatVideoTime(duration)}</span>
      <button type="button" onClick={() => { const next = !muted; setMuted(next); if (videoRef.current) videoRef.current.muted = next; revealControls(); }} aria-label={muted ? "Unmute video" : "Mute video"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">{muted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
      <button type="button" onClick={() => { toggleFullscreen(); revealControls(); }} aria-label="View video fullscreen" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><Maximize size={17} /></button>
    </div>}
    {failed && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 px-4 text-center text-sm font-semibold text-white"><span>Video unavailable. Check your connection.</span><button type="button" onClick={retryVideo} className="rounded-lg bg-white/15 px-3 py-1.5 underline underline-offset-2 hover:bg-white/25">Try again</button></div>}
  </div>;
}

function formatVideoTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function timeAgo(value: string) {
  const date = new Date(value);
  const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function NewsDescription({ caption }: { caption: string }) {
  const [expanded, setExpanded] = useState(false);
  const firstSentence = Array.from(new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(caption))[0]?.segment.trimEnd() ?? caption;
  const canExpand = firstSentence.trimEnd().length < caption.trimEnd().length;

  return <>
    <p
      className="whitespace-pre-wrap text-sm leading-6"
    >{expanded ? caption : firstSentence}</p>
    {canExpand && <button
      type="button"
      onClick={() => setExpanded((value) => !value)}
      aria-expanded={expanded}
      className="mt-1 text-sm font-semibold text-[#0d9b91] hover:underline"
    >{expanded ? "Show less" : "See more"}</button>}
  </>;
}

export function NewsFeed() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [activePostIndex, setActivePostIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewerStatus, setViewerStatus] = useState<"loading" | "guest" | "resident" | "other" | "error">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/news").then(async (response) => {
      if (!response.ok) throw new Error("News could not be loaded.");
      const result = await response.json();
      setPosts(result.posts);
    }).catch(() => toast.error("News could not be loaded. Refresh to try again.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me").then(async (response) => {
      if (!response.ok) throw new Error("Your sign-in status could not be checked.");
      const result = await response.json() as { user?: { role?: string } | null };
      if (active) setViewerStatus(result.user?.role === "RESIDENT" ? "resident" : result.user ? "other" : "guest");
    }).catch(() => {
      if (active) {
        setViewerStatus("error");
        toast.error("Your sign-in status could not be checked. Refresh before liking or commenting.");
      }
    });
    return () => { active = false; };
  }, []);

  async function requireResident() {
    let status = viewerStatus;
    if (status === "loading") {
      try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) throw new Error("Your sign-in status could not be checked.");
        const result = await response.json() as { user?: { role?: string } | null };
        status = result.user?.role === "RESIDENT" ? "resident" : result.user ? "other" : "guest";
        setViewerStatus(status);
      } catch {
        setViewerStatus("error");
        toast.error("Your sign-in status could not be checked. Refresh before liking or commenting.");
        return false;
      }
    }
    if (status === "guest") {
      router.push("/login?returnTo=%2F");
      return false;
    }
    if (status === "other") {
      toast.error("Sign in with a resident account to like or comment.");
      return false;
    }
    if (status === "error") {
      toast.error("Your sign-in status could not be checked. Refresh the page and try again.");
      return false;
    }
    return true;
  }

  async function toggleLike(post: Post) {
    if (!await requireResident()) return;
    if (!post.liked) {
      setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked: true, _count: { ...item._count, likes: item._count.likes + 1 } } : item));
    } else {
      setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked: false, _count: { ...item._count, likes: Math.max(0, item._count.likes - 1) } } : item));
    }
    try {
      const response = await fetch(`/api/news/${post.id}/like`, { method: "POST" });
      if (!response.ok) {
        const result = await response.json();
        if (response.status === 401) {
          setViewerStatus("guest");
          router.push("/login?returnTo=%2F");
        }
        throw new Error(result.error ?? "Your like could not be saved.");
      }
    } catch (error) {
      setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked: post.liked, _count: { ...item._count, likes: post._count.likes } } : item));
      toast.error(error instanceof Error ? error.message : "Your like could not be saved.");
    }
  }

  async function toggleComments(postId: string) {
    if (!await requireResident()) return;
    const next = expanded === postId ? null : postId;
    setExpanded(next);
    if (next && !comments[postId]) {
      try {
        const response = await fetch(`/api/news/${postId}/comments`);
        if (!response.ok) throw new Error("Comments could not be loaded.");
        const result = await response.json();
        setComments((items) => ({ ...items, [postId]: result.comments }));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Comments could not be loaded.");
      }
    }
  }

  async function addComment(postId: string) {
    if (!await requireResident()) return;
    const body = drafts[postId]?.trim();
    if (!body) return;
    setPosting(postId);
    try {
      const response = await fetch(`/api/news/${postId}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setViewerStatus("guest");
          router.push("/login?returnTo=%2F");
        }
        throw new Error(result.error ?? "Your comment could not be posted.");
      }
      setComments((items) => ({ ...items, [postId]: [result.comment, ...(items[postId] ?? [])] }));
      setPosts((items) => items.map((item) => item.id === postId ? { ...item, _count: { ...item._count, comments: item._count.comments + 1 } } : item));
      setDrafts((items) => ({ ...items, [postId]: "" }));
      toast.success("Comment added.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your comment could not be posted.");
    } finally {
      setPosting(null);
    }
  }

  if (loading) return <div className="h-[32rem] animate-pulse rounded-2xl bg-[var(--line)]" />;
  if (!posts.length) return <Card className="px-6 py-14 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[#0d9b91]"><ImageIcon /></div><h3 className="font-bold">No announcements yet</h3><p className="mt-1 text-sm text-[var(--muted)]">Check back soon for updates from your LGU.</p></Card>;

  const activePost = posts[Math.min(activePostIndex, posts.length - 1)];

  return <div className="space-y-4">
    {posts.length > 1 && <div className="flex items-center justify-between">
      <p aria-live="polite" className="text-xs font-semibold text-[var(--muted)]">Update {activePostIndex + 1} of {posts.length}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setActivePostIndex((index) => (index - 1 + posts.length) % posts.length)} aria-label="Previous community news" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] transition hover:border-[#0d9b91]/40 hover:bg-[var(--accent-soft)]"><ChevronLeft size={20} /></button>
        <button type="button" onClick={() => setActivePostIndex((index) => (index + 1) % posts.length)} aria-label="Next community news" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface)] text-[var(--foreground)] transition hover:border-[#0d9b91]/40 hover:bg-[var(--accent-soft)]"><ChevronRight size={20} /></button>
      </div>
    </div>}
    <Card key={activePost.id} className="overflow-hidden">
      {activePost.media.length > 0 && <div className="space-y-1 bg-slate-100 dark:bg-slate-800">{activePost.media.map((media, index) => <div key={media.id} className="relative aspect-[16/9] max-h-[min(70vh,760px)]">{media.type === "VIDEO" ? <NewsVideo media={media} index={index} /> : <img src={media.url} alt={`Community announcement ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />}</div>)}</div>}
      <div className="p-5 sm:p-8">
        <div className="mb-4 flex items-center justify-between text-xs text-[var(--muted)]"><span className="inline-flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[#0d9b91]">{activePost.author.adminProfile?.profilePhotoUrl ? <img src={activePost.author.adminProfile.profilePhotoUrl} alt={`${activePost.author.name}'s profile`} className="h-full w-full object-cover" /> : "LGU"}</span> Municipality of Tupi</span><time dateTime={activePost.createdAt}>{timeAgo(activePost.createdAt)}</time></div>
        <div className="max-w-5xl"><NewsDescription caption={activePost.caption} /></div>
        <div className="mt-4 flex items-center gap-4 border-t border-[var(--line)] pt-3">
          <button onClick={() => toggleLike(activePost)} aria-label={activePost.liked ? "Unlike this update" : "Like this update"} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition hover:bg-rose-50 dark:hover:bg-rose-950/40 ${activePost.liked ? "text-rose-600" : "text-[var(--muted)]"}`}><Heart size={18} className={activePost.liked ? "fill-current" : ""} />{activePost._count.likes}</button>
          <button onClick={() => toggleComments(activePost.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--background)]"><MessageCircle size={18} />{activePost._count.comments} comments</button>
        </div>
        <AnimatePresence initial={false}>{expanded === activePost.id && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="space-y-3 border-t border-[var(--line)] pt-4">
            <div className="max-h-48 space-y-3 overflow-y-auto">{(comments[activePost.id] ?? []).length ? comments[activePost.id].map((comment) => <div key={comment.id} className="rounded-xl bg-[var(--background)] px-3.5 py-2.5"><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[#0d9b91]">{comment.user.residentProfile?.profilePhotoUrl ? <img src={comment.user.residentProfile.profilePhotoUrl} alt="" className="h-full w-full object-cover" /> : comment.user.name.slice(0, 1).toUpperCase()}</span><span className="truncate text-xs font-bold">{comment.user.name}</span></span><time className="text-[10px] text-[var(--muted)]">{timeAgo(comment.createdAt)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p></div>) : <p className="py-1 text-center text-xs text-[var(--muted)]">Be the first to comment.</p>}</div>
            <div className="flex gap-2"><Input aria-label="Write a comment" placeholder="Add a comment…" maxLength={2000} value={drafts[activePost.id] ?? ""} onChange={(event) => setDrafts((items) => ({ ...items, [activePost.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void addComment(activePost.id); } }} /><Button aria-label="Post comment" loading={posting === activePost.id} onClick={() => void addComment(activePost.id)} className="min-w-11 px-3"><Send size={16} /></Button></div>
          </div>
        </motion.div>}</AnimatePresence>
      </div>
    </Card>
  </div>;
}

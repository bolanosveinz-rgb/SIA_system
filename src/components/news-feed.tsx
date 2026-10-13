"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageCircle, Send, Image as ImageIcon, Play } from "lucide-react";
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
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  async function playVideo() {
    try {
      await videoRef.current?.play();
    } catch {
      toast.error("This video could not be played. Please try again.");
    }
  }

  function retryVideo() {
    setFailed(false);
    videoRef.current?.load();
    void playVideo();
  }

  return <div className="relative aspect-[16/9] bg-black">
    <video
      ref={videoRef}
      controls
      playsInline
      preload="metadata"
      poster={cloudinaryVideoUrl(media.url, "so_0,f_jpg", "jpg")}
      className="h-full w-full object-contain"
      aria-label={`Community announcement video ${index + 1}`}
      onPlay={() => { setPlaying(true); setFailed(false); }}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onError={() => setFailed(true)}
    >
      <source src={cloudinaryVideoUrl(media.url, "f_mp4", "mp4")} type="video/mp4" />
    </video>
    {!playing && !failed && <button
      type="button"
      onClick={() => void playVideo()}
      aria-label={`Play community announcement video ${index + 1}`}
      className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/65 text-white shadow-lg ring-2 ring-white/80 transition hover:scale-105 hover:bg-[#0d9b91] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0d9b91]"
    >
      <Play size={28} fill="currentColor" className="ml-1" />
    </button>}
    {failed && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 px-4 text-center text-sm font-semibold text-white"><span>Video unavailable. Check your connection.</span><button type="button" onClick={retryVideo} className="rounded-lg bg-white/15 px-3 py-1.5 underline underline-offset-2 hover:bg-white/25">Try again</button></div>}
  </div>;
}

function timeAgo(value: string) {
  const date = new Date(value);
  const hours = Math.floor((Date.now() - date.getTime()) / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function NewsFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
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

  async function toggleLike(post: Post) {
    if (!post.liked) {
      setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked: true, _count: { ...item._count, likes: item._count.likes + 1 } } : item));
    } else {
      setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked: false, _count: { ...item._count, likes: Math.max(0, item._count.likes - 1) } } : item));
    }
    try {
      const response = await fetch(`/api/news/${post.id}/like`, { method: "POST" });
      if (!response.ok) throw new Error((await response.json()).error ?? "Sign in as a resident to like updates.");
    } catch (error) {
      setPosts((items) => items.map((item) => item.id === post.id ? { ...item, liked: post.liked, _count: { ...item._count, likes: post._count.likes } } : item));
      toast.error(error instanceof Error ? error.message : "Your like could not be saved.");
    }
  }

  async function toggleComments(postId: string) {
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
    const body = drafts[postId]?.trim();
    if (!body) return;
    setPosting(postId);
    try {
      const response = await fetch(`/api/news/${postId}/comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Your comment could not be posted.");
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

  if (loading) return <div className="grid gap-5 sm:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl bg-[var(--line)]" />)}</div>;
  if (!posts.length) return <Card className="px-6 py-14 text-center"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[#0d9b91]"><ImageIcon /></div><h3 className="font-bold">No announcements yet</h3><p className="mt-1 text-sm text-[var(--muted)]">Check back soon for updates from your LGU.</p></Card>;

  return <div className="grid gap-5 sm:grid-cols-2">
    {posts.map((post) => <Card key={post.id} className="overflow-hidden">
      {post.media.length > 0 && <div className="space-y-1 bg-slate-100 dark:bg-slate-800">{post.media.map((media, index) => <div key={media.id} className="relative aspect-[16/9]">{media.type === "VIDEO" ? <NewsVideo media={media} index={index} /> : <img src={media.url} alt={`Community announcement ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />}</div>)}</div>}
      <div className="p-5">
        <div className="mb-3 flex items-center justify-between text-xs text-[var(--muted)]"><span className="inline-flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[#0d9b91]">{post.author.adminProfile?.profilePhotoUrl ? <img src={post.author.adminProfile.profilePhotoUrl} alt={`${post.author.name}'s profile`} className="h-full w-full object-cover" /> : "LGU"}</span> Municipality of Tupi</span><time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time></div>
        <p className="whitespace-pre-wrap text-sm leading-6">{post.caption}</p>
        <div className="mt-4 flex items-center gap-4 border-t border-[var(--line)] pt-3">
          <button onClick={() => toggleLike(post)} aria-label={post.liked ? "Unlike this update" : "Like this update"} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition hover:bg-rose-50 dark:hover:bg-rose-950/40 ${post.liked ? "text-rose-600" : "text-[var(--muted)]"}`}><Heart size={18} className={post.liked ? "fill-current" : ""} />{post._count.likes}</button>
          <button onClick={() => toggleComments(post.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--background)]"><MessageCircle size={18} />{post._count.comments} comments</button>
        </div>
        <AnimatePresence initial={false}>{expanded === post.id && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
          <div className="space-y-3 border-t border-[var(--line)] pt-4">
            <div className="max-h-48 space-y-3 overflow-y-auto">{(comments[post.id] ?? []).length ? comments[post.id].map((comment) => <div key={comment.id} className="rounded-xl bg-[var(--background)] px-3.5 py-2.5"><div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[#0d9b91]">{comment.user.residentProfile?.profilePhotoUrl ? <img src={comment.user.residentProfile.profilePhotoUrl} alt="" className="h-full w-full object-cover" /> : comment.user.name.slice(0, 1).toUpperCase()}</span><span className="truncate text-xs font-bold">{comment.user.name}</span></span><time className="text-[10px] text-[var(--muted)]">{timeAgo(comment.createdAt)}</time></div><p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p></div>) : <p className="py-1 text-center text-xs text-[var(--muted)]">Be the first to comment.</p>}</div>
            <div className="flex gap-2"><Input aria-label="Write a comment" placeholder="Add a comment…" maxLength={2000} value={drafts[post.id] ?? ""} onChange={(event) => setDrafts((items) => ({ ...items, [post.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void addComment(post.id); } }} /><Button aria-label="Post comment" loading={posting === post.id} onClick={() => void addComment(post.id)} className="min-w-11 px-3"><Send size={16} /></Button></div>
          </div>
        </motion.div>}</AnimatePresence>
      </div>
    </Card>)}
  </div>;
}

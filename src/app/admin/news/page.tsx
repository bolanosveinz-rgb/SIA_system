"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, MessageCircle, Pencil, Plus, Trash2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input, Textarea } from "@/components/ui";
import { uploadToCloudinary, type UploadedMedia } from "@/lib/upload";

type Media = UploadedMedia & { id?: string };
type Comment = { id: string; body: string; createdAt: string; user: { name: string } };
type Post = { id: string; caption: string; createdAt: string; media: Media[]; _count: { likes: number; comments: number } };

export default function AdminNewsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [caption, setCaption] = useState("");
  const [media, setMedia] = useState<Media[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  async function loadPosts() {
    const response = await fetch("/api/news");
    if (!response.ok) throw new Error("News posts could not be loaded.");
    setPosts((await response.json()).posts);
  }
  useEffect(() => { void loadPosts().catch((error) => toast.error(error.message)).finally(() => setLoading(false)); }, []);

  function openCreate() {
    setEditing(null); setCaption(""); setMedia([]); setFiles([]); setFormOpen(true);
  }
  function openEdit(post: Post) {
    setEditing(post); setCaption(post.caption); setMedia(post.media); setFiles([]); setFormOpen(true);
  }
  function closeForm() {
    setEditing(null); setCaption(""); setMedia([]); setFiles([]); setProgress(0); setFormOpen(false);
  }

  async function savePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caption.trim()) return toast.error("Write a caption for this update.");
    if (media.length + files.length > 5) return toast.error("A news post can have up to five media files.");
    setUploading(true);
    try {
      const added: Media[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const result = await uploadToCloudinary(files[index], (value) => setProgress(Math.round(((index + value / 100) / files.length) * 100)));
        added.push(result);
      }
      const response = await fetch(editing ? `/api/news/${editing.id}` : "/api/news", {
        method: editing ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption, media: [...media, ...added].map(({ url, publicId, type }) => ({ url, publicId, type })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "This news post could not be saved.");
      toast.success(editing ? "News update saved." : "News update published.");
      closeForm();
      await loadPosts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This news post could not be saved.");
    } finally {
      setUploading(false);
    }
  }

  async function deletePost(post: Post) {
    if (!window.confirm("Delete this news post? Its comments and likes will also be removed.")) return;
    try {
      const response = await fetch(`/api/news/${post.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error ?? "This post could not be deleted.");
      setPosts((items) => items.filter((item) => item.id !== post.id));
      toast.success("News post deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This post could not be deleted.");
    }
  }

  async function toggleComments(postId: string) {
    setExpanded(expanded === postId ? null : postId);
    if (expanded === postId || comments[postId]) return;
    try {
      const response = await fetch(`/api/news/${postId}/comments`);
      if (!response.ok) throw new Error("Comments could not be loaded.");
      const result = await response.json();
      setComments((items) => ({ ...items, [postId]: result.comments }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Comments could not be loaded.");
    }
  }

  async function deleteComment(postId: string, commentId: string) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const response = await fetch(`/api/news/${postId}/comments?commentId=${encodeURIComponent(commentId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error((await response.json()).error ?? "This comment could not be deleted.");
      setComments((items) => ({ ...items, [postId]: (items[postId] ?? []).filter((item) => item.id !== commentId) }));
      setPosts((items) => items.map((post) => post.id === postId ? { ...post, _count: { ...post._count, comments: Math.max(0, post._count.comments - 1) } } : post));
      toast.success("Comment removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "This comment could not be deleted.");
    }
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]">Official communications</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">News & updates</h1><p className="mt-1 text-sm text-[var(--muted)]">Publish announcements, add media, and moderate community comments.</p></div><Button onClick={openCreate}><Plus size={17} /> New update</Button></div>
    {loading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((n) => <div key={n} className="h-80 animate-pulse rounded-2xl bg-[var(--line)]" />)}</div> : posts.length === 0 ? <Card className="p-12 text-center"><ImagePlus className="mx-auto mb-3 text-[#0d9b91]" /><h2 className="font-bold">No news posts yet</h2><p className="mt-1 text-sm text-[var(--muted)]">Publish your first community update.</p></Card> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{posts.map((post) => <Card key={post.id} className="overflow-hidden">
      {post.media[0] && <div className="aspect-[16/9] bg-[var(--background)]">{post.media[0].type === "VIDEO" ? <video src={post.media[0].url} controls className="h-full w-full object-cover" /> : <img src={post.media[0].url} alt="News media" className="h-full w-full object-cover" />}</div>}
      <div className="p-4"><p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6">{post.caption}</p><p className="mt-3 text-xs text-[var(--muted)]">{new Date(post.createdAt).toLocaleDateString("en-PH", { dateStyle: "medium" })} · {post.media.length} media</p><div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3"><button onClick={() => void toggleComments(post.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)] hover:text-[#0d9b91]"><MessageCircle size={15} />{post._count.comments} comments · {post._count.likes} likes</button><div className="flex gap-1"><button onClick={() => openEdit(post)} aria-label="Edit news post" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)] hover:text-[#0d9b91]"><Pencil size={15} /></button><button onClick={() => void deletePost(post)} aria-label="Delete news post" className="rounded-lg p-2 text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"><Trash2 size={15} /></button></div></div>
        {expanded === post.id && <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">{(comments[post.id] ?? []).length ? comments[post.id].map((comment) => <div key={comment.id} className="flex items-start justify-between gap-2 rounded-lg bg-[var(--background)] p-2.5"><div><p className="text-[11px] font-bold">{comment.user.name}<span className="ml-2 font-normal text-[var(--muted)]">{new Date(comment.createdAt).toLocaleDateString("en-PH")}</span></p><p className="mt-1 whitespace-pre-wrap text-xs">{comment.body}</p></div><button onClick={() => void deleteComment(post.id, comment.id)} aria-label="Delete comment" className="rounded p-1.5 text-[var(--muted)] hover:text-rose-600"><Trash2 size={14} /></button></div>) : <p className="text-center text-xs text-[var(--muted)]">No comments yet.</p>}</div>}
      </div>
    </Card>)}</div>}

    {formOpen && <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"><div role="dialog" aria-modal="true" aria-labelledby="news-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-5 shadow-2xl sm:rounded-3xl sm:p-7"><div className="mb-5 flex items-start justify-between"><div><h2 id="news-form-title" className="text-xl font-extrabold">{editing ? "Edit news update" : "Create news update"}</h2><p className="mt-1 text-sm text-[var(--muted)]">Share an official announcement with the community.</p></div><button onClick={closeForm} aria-label="Close editor" className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--background)]"><X /></button></div><form onSubmit={savePost} className="space-y-4"><label className="block space-y-1.5 text-sm font-bold">Caption / description<Textarea autoFocus value={caption} onChange={(event) => setCaption(event.target.value)} required minLength={3} maxLength={10000} placeholder="Write a clear, helpful update for Tupi residents…" className="min-h-32" /></label>
      <div><label className="mb-2 block text-sm font-bold">Photos or video <span className="font-normal text-[var(--muted)]">(up to 5 files · images 10 MB · video 50 MB)</span></label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line)] p-4 text-sm font-semibold text-[var(--muted)] transition hover:border-[#0d9b91] hover:bg-[var(--accent-soft)]"><Upload size={17} />Choose images or video<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={(event) => { const incoming = Array.from(event.target.files ?? []); if (media.length + files.length + incoming.length > 5) { toast.error("A news post can have up to five media files."); event.target.value = ""; return; } setFiles((items) => [...items, ...incoming]); event.target.value = ""; }} /></label>
        {(media.length + files.length > 0) && <div className="mt-3 grid grid-cols-3 gap-2">{media.map((item) => <div key={item.publicId} className="relative aspect-square overflow-hidden rounded-xl bg-[var(--background)]">{item.type === "VIDEO" ? <div className="flex h-full items-center justify-center"><Video className="text-[#0d9b91]" /></div> : <img src={item.url} alt="Attached media" className="h-full w-full object-cover" />}<button type="button" onClick={() => setMedia((items) => items.filter((value) => value.publicId !== item.publicId))} aria-label="Remove media" className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X size={13} /></button></div>)}{files.map((file, index) => <div key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-xl bg-[var(--background)]">{file.type.startsWith("video/") ? <div className="flex h-full items-center justify-center"><Video className="text-[#0d9b91]" /></div> : <img src={previews[index]} alt={file.name} className="h-full w-full object-cover" />}<button type="button" onClick={() => setFiles((items) => items.filter((_, i) => i !== index))} aria-label="Remove selected file" className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"><X size={13} /></button></div>)}</div>}
      </div>
      {uploading && <div><div className="mb-1 flex justify-between text-xs text-[var(--muted)]"><span>Uploading media…</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full bg-[#0d9b91] transition-all" style={{ width: `${progress}%` }} /></div></div>}
      <div className="flex justify-end gap-2 border-t border-[var(--line)] pt-4"><Button type="button" variant="secondary" disabled={uploading} onClick={closeForm}>Cancel</Button><Button type="submit" loading={uploading}>{editing ? "Save changes" : "Publish update"}</Button></div>
    </form></div></div>}
  </div>;
}

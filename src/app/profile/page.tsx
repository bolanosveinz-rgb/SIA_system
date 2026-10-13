"use client";

import { useEffect, useState } from "react";
import { Camera, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card } from "@/components/ui";
import { uploadToCloudinary } from "@/lib/upload";

type Profile = {
  name: string;
  email: string;
  profile: {
    barangay: string;
    profilePhotoUrl: string | null;
    profilePhotoPublicId: string | null;
  } | null;
};

export default function ResidentProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadProfile() {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/auth/me");
      const data = await response.json();
      if (!response.ok || !data.user || data.user.role !== "RESIDENT") {
        throw new Error(data.error ?? "Sign in as a resident to manage your profile.");
      }
      setProfile(data.user);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your profile could not be loaded.";
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProfile(); }, []);
  useEffect(() => {
    if (!photo) {
      setPreview("");
      return;
    }
    const objectUrl = URL.createObjectURL(photo);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photo]);

  async function savePhoto() {
    if (!profile?.profile) return;
    setSaving(true);
    try {
      let profilePhotoUrl = removePhoto ? "" : profile.profile.profilePhotoUrl ?? "";
      let profilePhotoPublicId = removePhoto ? "" : profile.profile.profilePhotoPublicId ?? "";
      if (photo) {
        const uploaded = await uploadToCloudinary(photo);
        profilePhotoUrl = uploaded.url;
        profilePhotoPublicId = uploaded.publicId;
      }

      const response = await fetch("/api/resident/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profilePhotoUrl, profilePhotoPublicId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Your profile picture could not be saved.");
      setProfile((current) => current?.profile
        ? { ...current, profile: { ...current.profile, ...data.profile } }
        : current);
      setPhoto(null);
      setRemovePhoto(false);
      window.dispatchEvent(new Event("servelink:profile-updated"));
      toast.success(profilePhotoUrl ? "Profile picture updated." : "Profile picture removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Your profile picture could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  const currentPhoto = removePhoto ? "" : preview || profile?.profile?.profilePhotoUrl || "";

  return <>
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]">Resident account</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">My profile</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Manage your profile picture and view your account details.</p>
      {loading ? <div className="mt-6 h-64 animate-pulse rounded-2xl bg-[var(--line)]" /> : loadError ? <Card className="mt-6 space-y-4 p-6"><p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{loadError}</p><Button type="button" variant="secondary" onClick={() => void loadProfile()}>Retry</Button></Card> : profile && <Card className="mt-6 space-y-6 p-5 sm:p-7">
        <div className="flex flex-col items-center gap-5 sm:flex-row">
          {currentPhoto
            ? <img src={currentPhoto} alt="Your profile picture" className="h-28 w-28 rounded-full object-cover ring-4 ring-[var(--accent-soft)]" />
            : <span className="flex h-28 w-28 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[#0d9b91]"><UserRound size={44} /></span>}
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="text-lg font-bold">{profile.name}</h2>
            <p className="text-sm text-[var(--muted)]">{profile.email}</p>
            <p className="text-sm text-[var(--muted)]">{profile.profile?.barangay ?? "Resident"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-5">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--background)]">
            <Camera size={17} />Choose picture<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setPhoto(event.target.files?.[0] ?? null); setRemovePhoto(false); }} />
          </label>
          {currentPhoto && <button type="button" onClick={() => { setPhoto(null); setRemovePhoto(true); }} className="inline-flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"><X size={16} />Remove picture</button>}
          <Button type="button" disabled={(!photo && !removePhoto) || saving} loading={saving} onClick={() => void savePhoto()}>{saving ? "Saving…" : "Save picture"}</Button>
        </div>
        <p className="text-xs text-[var(--muted)]">JPG, PNG, or WebP · Maximum 10 MB</p>
      </Card>}
    </main>
  </>;
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Building2, Camera, KeyRound, Upload, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Input } from "@/components/ui";
import { uploadToCloudinary } from "@/lib/upload";

type Settings = {
  name: string;
  email: string;
  adminProfile: {
    officeName: string;
    contact: string;
    address: string;
    logoUrl: string | null;
    profilePhotoUrl: string | null;
    profilePhotoPublicId: string | null;
  } | null;
};

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [profilePhotoPreview, setProfilePhotoPreview] = useState("");

  useEffect(() => {
    if (!photo) {
      setLogoPreview("");
      return;
    }
    const preview = URL.createObjectURL(photo);
    setLogoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photo]);

  useEffect(() => {
    if (!profilePhoto) {
      setProfilePhotoPreview("");
      return;
    }
    const preview = URL.createObjectURL(profilePhoto);
    setProfilePhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [profilePhoto]);

  useEffect(() => {
    fetch("/api/admin/settings").then(async (response) => {
      if (!response.ok) throw new Error("Settings could not be loaded.");
      const data = await response.json();
      setProfile(data.profile);
    }).catch((error) => toast.error(error instanceof Error ? error.message : "Settings could not be loaded.")).finally(() => setLoading(false));
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      let logoUrl = profile.adminProfile?.logoUrl ?? "";
      let profilePhotoUrl = profile.adminProfile?.profilePhotoUrl ?? "";
      let profilePhotoPublicId = profile.adminProfile?.profilePhotoPublicId ?? "";
      if (photo) {
        setUploading(true);
        logoUrl = (await uploadToCloudinary(photo)).url;
      }
      if (profilePhoto) {
        setUploading(true);
        const uploaded = await uploadToCloudinary(profilePhoto);
        profilePhotoUrl = uploaded.url;
        profilePhotoPublicId = uploaded.publicId;
      }
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          officeName: profile.adminProfile?.officeName ?? "Municipality of Tupi",
          contact: profile.adminProfile?.contact ?? "",
          address: profile.adminProfile?.address ?? "",
          logoUrl,
          profilePhotoUrl,
          profilePhotoPublicId,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Profile could not be updated.");
      setProfile(data.profile);
      setPhoto(null);
      setProfilePhoto(null);
      window.dispatchEvent(new Event("servelink:profile-updated"));
      toast.success("LGU profile saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile could not be updated.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.newPassword !== values.confirmPassword) return toast.error("Your new passwords do not match.");
    setChangingPassword(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Password could not be changed.");
      form.reset();
      toast.success("Password changed successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Password could not be changed.");
    } finally {
      setChangingPassword(false);
    }
  }

  function updateProfile<K extends keyof Settings>(key: K, value: Settings[K]) {
    setProfile((current) => current ? { ...current, [key]: value } : current);
  }
  function updateOffice<K extends "officeName" | "contact" | "address" | "profilePhotoUrl" | "profilePhotoPublicId">(key: K, value: string) {
    setProfile((current) => current ? { ...current, adminProfile: { officeName: "", contact: "", address: "", logoUrl: null, profilePhotoUrl: null, profilePhotoPublicId: null, ...current.adminProfile, [key]: value } } : current);
  }

  return <div className="mx-auto max-w-4xl space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]">Account & organization</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1><p className="mt-1 text-sm text-[var(--muted)]">Keep your LGU information current and protect your account.</p></div>
    {loading ? <div className="h-96 animate-pulse rounded-2xl bg-[var(--line)]" /> : <Card className="p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[#0d9b91]"><Building2 size={19} /></span><div><h2 className="font-bold">LGU profile</h2><p className="text-xs text-[var(--muted)]">Information visible to residents in official updates.</p></div></div>
      {profile && <form onSubmit={saveProfile} className="space-y-4"><label className="block space-y-1.5 text-sm font-semibold">Administrator profile picture <span className="font-normal text-[var(--muted)]">(optional · JPG, PNG, WebP · max 10 MB)</span><span className="flex items-center gap-4 rounded-xl border border-dashed border-[var(--line)] p-3">{(profilePhotoPreview || profile.adminProfile?.profilePhotoUrl) ? <img src={profilePhotoPreview || profile.adminProfile?.profilePhotoUrl || ""} alt="Administrator profile picture preview" className="h-16 w-16 rounded-full object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[#0d9b91]"><UserRound size={24} /></span>}<span className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><Camera size={15} /><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload administrator profile picture" onChange={(event) => setProfilePhoto(event.target.files?.[0] ?? null)} /></span>{(profilePhoto || profile.adminProfile?.profilePhotoUrl) && <button type="button" onClick={() => { setProfilePhoto(null); updateOffice("profilePhotoUrl", ""); updateOffice("profilePhotoPublicId", ""); }} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"><X size={14} />Remove photo</button>}</span></span></label><label className="block space-y-1.5 text-sm font-semibold">Office name<Input required minLength={2} maxLength={160} value={profile.adminProfile?.officeName ?? "Municipality of Tupi"} onChange={(event) => updateOffice("officeName", event.target.value)} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1.5 text-sm font-semibold">Administrator name<Input required minLength={2} maxLength={120} value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} /></label><label className="block space-y-1.5 text-sm font-semibold">Contact email<Input required type="email" maxLength={191} value={profile.email} onChange={(event) => updateProfile("email", event.target.value)} /></label><label className="block space-y-1.5 text-sm font-semibold">Office contact number<Input maxLength={80} value={profile.adminProfile?.contact ?? ""} onChange={(event) => updateOffice("contact", event.target.value)} placeholder="+63…" /></label><label className="block space-y-1.5 text-sm font-semibold">Office address<Input maxLength={300} value={profile.adminProfile?.address ?? ""} onChange={(event) => updateOffice("address", event.target.value)} placeholder="Tupi, South Cotabato" /></label></div><label className="block space-y-2 text-sm font-semibold">Office logo <span className="font-normal text-[var(--muted)]">(optional · JPG, PNG, WebP · max 10 MB)</span><span className="flex items-center gap-4 rounded-xl border border-dashed border-[var(--line)] p-3">{(logoPreview || profile.adminProfile?.logoUrl) && <img src={logoPreview || profile.adminProfile?.logoUrl || ""} alt="Office logo preview" className="h-14 w-14 rounded-lg object-cover" />}<span className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]"><Upload size={15} /><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload office logo" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></span></span></label><Button type="submit" loading={saving}>{uploading ? "Uploading…" : "Save LGU profile"}</Button></form>}
    </Card>}
    <Card className="p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-200"><KeyRound size={19} /></span><div><h2 className="font-bold">Change password</h2><p className="text-xs text-[var(--muted)]">Use at least 8 characters.</p></div></div><form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2"><label className="block space-y-1.5 text-sm font-semibold sm:col-span-2">Current password<Input name="currentPassword" autoComplete="current-password" type="password" required maxLength={100} /></label><label className="block space-y-1.5 text-sm font-semibold">New password<Input name="newPassword" autoComplete="new-password" type="password" required minLength={8} maxLength={100} /></label><label className="block space-y-1.5 text-sm font-semibold">Confirm new password<Input name="confirmPassword" autoComplete="new-password" type="password" required minLength={8} maxLength={100} /></label><div className="sm:col-span-2"><Button type="submit" variant="secondary" loading={changingPassword}>Update password</Button></div></form></Card>
    <p className="flex items-center gap-2 text-xs text-[var(--muted)]"><UserRound size={14} /> Admin accounts are managed by the database seed script; public administrator registration is disabled.</p>
  </div>;
}

"use client";

import { useState, type FormEvent } from "react";
import { Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, Textarea } from "@/components/ui";

const MAX_ANNOUNCEMENT_LENGTH = 450;

export default function OfficialsAnnouncementsPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function sendAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    try {
      const response = await fetch("/api/officials/announcements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The announcement could not be sent.");
      setMessage("");
      toast.success(`Announcement sent to ${result.recipients} residents.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The announcement could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#0d9b91]">Community updates</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">Announcements</h1><p className="mt-1 text-sm text-[var(--muted)]">Send an official update directly to residents’ notifications.</p></div>
    <Card className="p-5 sm:p-7">
      <div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[#0d9b91]"><Megaphone size={19} /></span><div><h2 className="font-bold">New announcement</h2><p className="text-xs text-[var(--muted)]">All resident accounts will receive this notification, credited to Officials.</p></div></div>
      <form onSubmit={sendAnnouncement} className="space-y-4">
        <label className="block space-y-2 text-sm font-semibold" htmlFor="announcement-message">Announcement message
          <Textarea id="announcement-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Example: A festival will be held at the Municipal gym." maxLength={MAX_ANNOUNCEMENT_LENGTH} required minLength={3} className="min-h-36" />
        </label>
        <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row sm:items-center"><p className="text-xs text-[var(--muted)]">{message.length}/{MAX_ANNOUNCEMENT_LENGTH} characters</p><Button type="submit" loading={sending} disabled={message.trim().length < 3}><Send size={16} /> Send to residents</Button></div>
      </form>
    </Card>
    <p className="text-xs leading-5 text-[var(--muted)]">Residents will see “Officials” as the sender in their notification inbox and receive an on-screen alert while using ServeLink.</p>
  </div>;
}

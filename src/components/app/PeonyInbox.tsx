"use client";



import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {

  Archive,

  Bell,

  Check,

  ChevronDown,

  Clock3,

  ExternalLink,

  FileText,

  Inbox,

  Loader2,

  Mail,

  Menu,

  MoreHorizontal,

  Paperclip,

  RefreshCw,

  Search,

  Send,

  Settings2,

  Sparkles,

  Tag,

  Trash2,

  X,

} from "lucide-react";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";



 type Category = "Priority" | "Updates" | "Later";

type Accent = "rose" | "iris" | "mint" | "butter";

type EmailStatus = "active" | "done" | "snoozed";



type Email = {

  id: string;

  sender: string;

  sender_email: string;

  initials: string;

  subject: string;

  preview: string;

  received_at: string;

  category: Category;

  garden: string;

  tag: string;

  unread: boolean;

  accent: Accent;

  body: string;

  action: string | null;

  status: EmailStatus;

  source: "gmail" | "demo";

  gmail_message_id: string | null;

  gmail_thread_id: string | null;

};



type GmailStatus = { connected: boolean; email?: string | null; lastSyncedAt?: string | null };



const navItems: { label: Category; icon: typeof Inbox }[] = [

  { label: "Priority", icon: Inbox },

  { label: "Updates", icon: Bell },

  { label: "Later", icon: Clock3 },

];

const gardens = ["Job Search", "Work", "Purchases", "Travel", "Personal"];



function formatTime(value: string) {

  const date = new Date(value);

  const now = new Date();

  const sameDay = date.toDateString() === now.toDateString();

  return sameDay

    ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date)

    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);

}



function formatSync(value?: string | null) {
  if (!value) return "Not synced yet";
  return `Synced ${formatTime(value)}`;
}

function senderDomain(email: string) {
  const match = email.trim().match(/@([^>\s]+)$/);
  return match?.[1]?.toLowerCase() ?? "";
}

function senderBadge(email: string, initials: string) {
  const domain = senderDomain(email).replace(/^www\./, "");
  if (!domain) return initials.slice(0, 2).toUpperCase();

  const parts = domain.split(".").filter(Boolean);
  const name = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  const letters = name.replace(/[^a-z0-9]/gi, "").slice(0, 2);
  return (letters || initials.slice(0, 2)).toUpperCase();
}

function SenderAvatar({
  email,
  initials,
  accent,
  detail = false,
}: {
  email: string;
  initials: string;
  accent: Accent;
  detail?: boolean;
}) {
  const badge = senderBadge(email, initials);

  return (
    <span
      className={`${detail ? "detail-avatar" : "message-avatar"} avatar-${accent} sender-avatar`}
      aria-hidden="true"
      title={senderDomain(email) || "Sender"}
    >
      <span>{badge}</span>
    </span>
  );
}

function EmailBody({ body, fallback }: { body: string; fallback: string }) {
  const text = (body.trim() || fallback.trim())
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  const blocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  function renderInline(value: string, keyPrefix: string) {
    const parts = value.split(/(https?:\/\/[^\s<]+)/g);

    return parts.flatMap((part, partIndex) => {
      if (!/^https?:\/\//.test(part)) {
        return [<span key={`${keyPrefix}-text-${partIndex}`}>{part}</span>];
      }

      const trailing = part.match(/[),.;:!?]+$/)?.[0] ?? "";
      const href = trailing ? part.slice(0, -trailing.length) : part;

      return [
        <a key={`${keyPrefix}-link-${partIndex}`} href={href} target="_blank" rel="noreferrer">
          {href}
        </a>,
        trailing ? <span key={`${keyPrefix}-trail-${partIndex}`}>{trailing}</span> : null,
      ].filter(Boolean);
    });
  }

  return (
    <div className="email-body" aria-label="Email body">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const isBulletList = lines.length > 0 && lines.every((line) => /^([•*–-])\s+/.test(line));

        if (isBulletList) {
          return (
            <ul key={`list-${index}`}>
              {lines.map((line, lineIndex) => (
                <li key={`${index}-${lineIndex}`}>
                  {renderInline(line.replace(/^([•*–-])\s+/, ""), `${index}-${lineIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${index}-${block.slice(0, 20)}`}>
            {lines.map((line, lineIndex) => (
              <span key={`${index}-line-${lineIndex}`}>
                {lineIndex > 0 && <br />}
                {renderInline(line, `${index}-${lineIndex}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}


export default function PeonyInbox() {

  const [category, setCategory] = useState<Category>("Priority");

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [mobileOpen, setMobileOpen] = useState(false);

  const [emails, setEmails] = useState<Email[]>([]);

  const [loading, setLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);

  const [gmail, setGmail] = useState<GmailStatus>({ connected: false });
  const [userId, setUserId] = useState<string | null>(null);
  const syncInFlight = useRef(false);
  const realtimeReloadTimer = useRef<number | null>(null);

  const [gmailSetupError, setGmailSetupError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [tagOpen, setTagOpen] = useState(false);

  const [moreOpen, setMoreOpen] = useState(false);

  const [utilityOpen, setUtilityOpen] = useState<"notifications" | "settings" | null>(null);

  const [sent, setSent] = useState(false);

  const [reply, setReply] = useState("");



  const loadEmails = useCallback(async (userId?: string) => {

    const supabase = createClient();

    let uid = userId;

    if (!uid) {

      const { data } = await supabase.auth.getUser();

      uid = data.user?.id;

    }

    if (!uid) return;



    const { data, error } = await supabase

      .from("emails")

      .select("id,sender,sender_email,initials,subject,preview,received_at,category,garden,tag,unread,accent,body,action,status,source,gmail_message_id,gmail_thread_id")

      .eq("user_id", uid)

      .order("received_at", { ascending: false });



    if (error) {

      setNotice(error.message);

      return;

    }

    const rows = (data ?? []) as Email[];

    setEmails(rows);

    setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);

  }, []);



  const refreshGmail = useCallback(async (silent = false) => {
    if (!gmail.connected || syncInFlight.current) return;

    syncInFlight.current = true;
    if (!silent) setSyncing(true);

    try {
      const response = await fetch("/api/gmail/sync", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Gmail sync failed");

      await loadEmails();

      const statusResponse = await fetch("/api/gmail/status", { cache: "no-store" });
      const status = await statusResponse.json().catch(() => ({ connected: false }));
      if (statusResponse.ok) {
        setGmail(status);
        setGmailSetupError(null);
      }

      if (!silent) setNotice(`${payload.count ?? 0} Gmail messages checked.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gmail sync failed";
      if (!silent) setNotice(message);
      else console.error("Background Gmail sync failed:", error);
    } finally {
      syncInFlight.current = false;
      if (!silent) setSyncing(false);
    }
  }, [gmail.connected, loadEmails]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!authData.user) {
        window.location.href = "/login?next=/app";
        return;
      }

      setUserId(authData.user.id);

      const statusResponse = await fetch("/api/gmail/status", { cache: "no-store" });
      const statusPayload = await statusResponse.json().catch(() => ({}));
      const status = statusResponse.ok
        ? statusPayload
        : { connected: false };

      if (cancelled) return;
      setGmail(status);
      setGmailSetupError(
        statusResponse.ok ? null : (statusPayload.error ?? null)
      );
      if (!statusResponse.ok && statusPayload.error) {
        setNotice(statusPayload.error);
      }

      // Keep existing demo rows until Gmail is connected. Once Gmail is connected,
      // the UI switches to source=gmail so demo content never masquerades as real mail.
      if (status.connected) {
        const syncResponse = await fetch("/api/gmail/sync", { method: "POST" });
        if (!syncResponse.ok) {
          const syncPayload = await syncResponse.json().catch(() => ({}));
          if (!cancelled) setNotice(syncPayload.error ?? "Gmail sync failed");
        }

        // Refresh existing messages once after the improved Gmail body parser
        // is deployed, so already-synced messages receive the repaired text too.
        const repairKey = `peony-body-repair-v2:${authData.user.id}`;
        if (!window.localStorage.getItem(repairKey)) {
          const repairResponse = await fetch("/api/gmail/sync?repair=1", { method: "POST" });
          if (repairResponse.ok) window.localStorage.setItem(repairKey, "done");
        }
      }

      if (cancelled) return;

      await loadEmails(authData.user.id);

      if (!cancelled) {
        setLoading(false);
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [loadEmails]);

  // Keep Realtime separate from the async boot process. The callback is added
  // before subscribe(), and the channel is removed when the component unmounts
  // or the authenticated user changes.
  useEffect(() => {
    if (!userId || !isSupabaseConfigured()) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`peony-emails-live-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "emails",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (realtimeReloadTimer.current !== null) {
            window.clearTimeout(realtimeReloadTimer.current);
          }
          realtimeReloadTimer.current = window.setTimeout(() => {
            realtimeReloadTimer.current = null;
            void loadEmails(userId);
          }, 150);
        }
      )
      .subscribe((status, error) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Peony Realtime subscription error:", error);
        }
      });

    return () => {
      if (realtimeReloadTimer.current !== null) {
        window.clearTimeout(realtimeReloadTimer.current);
        realtimeReloadTimer.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [userId, loadEmails]);
  useEffect(() => {

    if (!gmail.connected) return;

    const timer = window.setInterval(() => void refreshGmail(true), 60_000);

    return () => window.clearInterval(timer);

  }, [gmail.connected, refreshGmail]);



  useEffect(() => {

    const params = new URLSearchParams(window.location.search);

    const connected = params.get("gmail_connected");

    const error = params.get("gmail_error");

    if (connected) {

      setNotice("Gmail connected. Peony is syncing your inbox now.");

      window.history.replaceState({}, "", "/app");

    } else if (error) {

      setNotice(`Gmail connection: ${error}`);

      window.history.replaceState({}, "", "/app");

    }

  }, []);



  const visibleEmails = useMemo(() => {

    const q = query.trim().toLowerCase();

    const source = gmail.connected ? "gmail" : "demo";

    return emails.filter((email) => {

      const matchesCategory = email.category === category;

      const matchesSource = email.source === source;

      const matchesSearch = !q || [email.sender, email.sender_email, email.subject, email.preview, email.garden, email.tag]

        .join(" ").toLowerCase().includes(q);

      return matchesCategory && matchesSource && matchesSearch && email.status === "active";

    });

  }, [category, emails, query, gmail.connected]);



  const selected = emails.find((email) => email.id === selectedId && email.status !== "done") ?? visibleEmails[0] ?? null;



  async function appUpdate(id: string, patch: Partial<Email>, actionKind?: string) {

    setEmails((current) => current.map((email) => email.id === id ? { ...email, ...patch } : email));

    const email = emails.find((row) => row.id === id);

    if (!email || email.source !== "gmail") return;

    const supabase = createClient();

    const { error } = await supabase.from("emails").update(patch).eq("id", id);

    if (error) setNotice(error.message);

    if (actionKind) {

      const { data: authData } = await supabase.auth.getUser();

      if (authData.user) await supabase.from("email_actions").insert({ user_id: authData.user.id, email_id: id, kind: actionKind });

    }

  }



  async function gmailAction(action: "archive" | "delete" | "mark_read" | "mark_unread", patch: Partial<Email>, actionKind: string) {

    if (!selected) return;

    if (!selected.gmail_message_id) return appUpdate(selected.id, patch, actionKind);

    try {

      const response = await fetch("/api/gmail/message", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({ messageId: selected.gmail_message_id, action }),

      });

      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error ?? "Gmail action failed");

      await appUpdate(selected.id, patch, actionKind);

      setSelectedId(null);

      setNotice(action === "delete" ? "Moved to Gmail Trash." : action === "archive" ? "Archived in Gmail." : "Gmail updated.");

    } catch (error) {

      setNotice(error instanceof Error ? error.message : "Gmail action failed");

    }

  }



  async function archive() { await gmailAction("archive", { status: "done", unread: false }, "archive"); }

  async function trash() { await gmailAction("delete", { status: "done", unread: false }, "delete"); }

  async function markRead(unread = false, emailOverride?: Email) {

    const target = emailOverride ?? selected;

    if (!target) return;

    if (!target.gmail_message_id) { await appUpdate(target.id, { unread }, unread ? "mark_unread" : "mark_read"); return; }

    try {

      const response = await fetch("/api/gmail/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: target.gmail_message_id, action: unread ? "mark_unread" : "mark_read" }) });

      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error ?? "Gmail action failed");

      await appUpdate(target.id, { unread }, unread ? "mark_unread" : "mark_read");

    } catch (error) { setNotice(error instanceof Error ? error.message : "Gmail action failed"); }

  }

  async function snooze() {

    if (!selected) return;

    await appUpdate(selected.id, { status: "snoozed" }, "snooze");

    setSelectedId(null);

    setNotice("Snoozed in Peony. It stays untouched in Gmail.");

  }



  async function tagEmail(garden: string) {

    if (!selected) return;

    await appUpdate(selected.id, { garden, tag: garden }, "follow_up");

    setTagOpen(false);

  }



  async function sendReply() {

    if (!selected || !reply.trim()) return;

    if (selected.source === "demo") {

      setSent(true);

      setTimeout(() => setSent(false), 1800);

      return;

    }

    try {

      const response = await fetch("/api/gmail/message", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          messageId: selected.gmail_message_id,

          action: "send_reply",

          detail: { body: reply.trim(), to: selected.sender_email, subject: selected.subject, threadId: selected.gmail_thread_id },

        }),

      });

      const payload = await response.json();

      if (!response.ok) throw new Error(payload.error ?? "Reply failed");

      setSent(true);

      setReply("");

      setNotice("Reply sent through Gmail.");

      setTimeout(() => setSent(false), 1800);

    } catch (error) {

      setNotice(error instanceof Error ? error.message : "Reply failed");

    }

  }



  async function signOut() {

    await createClient().auth.signOut();

    window.location.href = "/";

  }



  function connectGmail() {
    if (gmailSetupError) {
      setNotice(gmailSetupError);
      return;
    }
    window.location.href = "/api/gmail/connect";
  }



  if (loading) {

    return <main className="inbox-loading"><span className="inbox-loading-flower">✿</span><h1>Opening your inbox...</h1><p>Peony is bringing the important things forward.</p></main>;

  }



  const counts = Object.fromEntries(navItems.map(({ label }) => [label, emails.filter((email) => email.source === (gmail.connected ? "gmail" : "demo") && email.category === label && email.status === "active").length])) as Record<Category, number>;



  return (

    <main className="inbox-app">

      <header className="inbox-topbar">

        <a className="inbox-brand" href="/"><span className="inbox-flower">✿</span><span>Peony</span></a>

        <div className="inbox-search"><Search size={16} /><input aria-label="Search your inbox" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your inbox..." /><kbd>⌘ K</kbd></div>

        <div className="inbox-top-actions">

          <button
            className={`cloud-status ${gmail.connected ? "is-cloud" : "is-connect"} ${syncing ? "is-syncing" : ""}`}
            onClick={gmail.connected ? () => void refreshGmail(false) : connectGmail}
            title={gmail.connected ? "Gmail connected · click to sync now" : "Connect your Gmail inbox"}
            aria-label={gmail.connected ? "Gmail connected. Click to sync now." : "Connect Gmail"}
          >
            {syncing ? <Loader2 size={13} className="spin" /> : gmail.connected ? <Check size={13} /> : <Mail size={13} />}
            <span className="cloud-status-label">{syncing ? "Syncing" : gmail.connected ? "Gmail" : "Connect Gmail"}</span>
            {gmail.connected && !syncing && <span className="cloud-status-state">Connected</span>}
          </button>

          <button className="icon-button" aria-label="Refresh Gmail" onClick={() => void refreshGmail(false)} disabled={!gmail.connected || syncing}><RefreshCw size={17} className={syncing ? "spin" : ""} /></button>

          <button className="icon-button" aria-label="Notifications" onClick={() => setUtilityOpen(utilityOpen === "notifications" ? null : "notifications")}><Bell size={17} /></button>

          <button className="icon-button" aria-label="Settings" onClick={() => setUtilityOpen(utilityOpen === "settings" ? null : "settings")}><Settings2 size={17} /></button>

          <button className="profile-avatar" onClick={signOut} title="Sign out">R</button>

        </div>

        <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu"><Menu size={19} /></button>

      </header>



      {utilityOpen && <div className="utility-popover">

        {utilityOpen === "notifications" ? <><strong>Inbox activity</strong><span>{gmail.connected ? "Peony checks Gmail every minute while this page is open." : "Connect Gmail to receive live inbox updates."}</span><small>{formatSync(gmail.lastSyncedAt)}</small></> : <><strong>Peony settings</strong><span>Gmail sync is on while this page is open.</span><button onClick={connectGmail}>{gmail.connected ? "Reconnect Gmail" : "Connect Gmail"}</button></>}

      </div>}



      <div className="inbox-layout">

        <aside className={`inbox-sidebar ${mobileOpen ? "is-open" : ""}`}>

          <div className="sidebar-close-row"><span>Your inbox</span><button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={17} /></button></div>

          <div className="inbox-nav-section"><span className="inbox-label">Inbox</span>{navItems.map(({ label, icon: Icon }) => <button key={label} className={`inbox-nav-item ${category === label ? "active" : ""}`} onClick={() => { setCategory(label); setMobileOpen(false); }}><span><Icon size={15} />{label}</span><b>{counts[label]}</b></button>)}</div>

          <div className="inbox-nav-section"><span className="inbox-label">Gardens</span>{gardens.map((garden) => <button key={garden} className="garden-nav-item" onClick={() => setQuery(garden)}><span className="garden-dot">✿</span>{garden}</button>)}</div>

          {gmailSetupError && <div className="peony-tip peony-tip--error">
            <X size={15} />
            <div>
              <strong>Gmail setup needs attention</strong>
              <span>{gmailSetupError}</span>
              <button onClick={() => window.location.reload()}>Check again →</button>
            </div>
          </div>}

          {!gmail.connected ? <div className="peony-tip"><Mail size={15} /><div><strong>Demo inbox</strong><span>Your sample messages stay here until you connect Gmail.</span><button onClick={connectGmail}>Connect Gmail →</button></div></div> : <div className="peony-tip"><Sparkles size={15} /><div><strong>Your Gmail is connected.</strong><span>Peony syncs every minute while open.</span></div></div>}

          <div className="sidebar-bottom"><a href="/">← Back to Peony</a></div>

        </aside>



        <section className="inbox-main">

          <div className="inbox-heading"><div><span className="inbox-kicker">{gmail.connected ? `Gmail · ${gmail.email ?? "connected"}` : "Demo inbox"} · {category}</span><h1>{category === "Priority" ? "Good morning." : category}</h1><p>{category === "Priority" ? "Here’s what deserves your attention." : category === "Updates" ? "Peony summarized these so you can skim and go." : "Kept out of your way until you go looking."}</p></div><button className="ask-peony-button" onClick={() => setNotice("Ask Peony will use your synced inbox in the next AI phase.")}><Sparkles size={15} /> Ask Peony</button></div>

          {notice && <div className="inbox-notice"><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button></div>}



          <div className="inbox-content">

            <div className="message-list-panel">

              <div className="list-toolbar"><span><b>{visibleEmails.length}</b> messages</span><button onClick={() => setQuery("")}><ChevronDown size={14} /> Newest</button></div>

              {visibleEmails.map((email) => <button className={`message-row ${selected?.id === email.id ? "selected" : ""}`} key={email.id} onClick={() => { setSelectedId(email.id); setSent(false); if (email.unread && email.source === "gmail") void markRead(false, email); }}><SenderAvatar email={email.sender_email} initials={email.initials} accent={email.accent} /><span className="message-row-copy"><span className="message-row-top"><strong>{email.sender}</strong><time>{formatTime(email.received_at)}</time></span><span className="message-subject">{email.subject}</span><span className="message-preview">{email.preview}</span><span className="message-meta"><span className={`message-pill pill-${email.accent}`}>{email.tag || email.category}</span><span>✿ {email.garden}</span></span></span>{email.unread && <span className="unread-dot" />}</button>)}

              {visibleEmails.length === 0 && <div className="empty-state"><span>✿</span><h3>{gmail.connected ? "Your inbox is clear." : "Nothing here."}</h3><p>{gmail.connected ? "Peony is showing the real Gmail inbox. Try another category or search." : "Connect Gmail to replace these samples with your real inbox."}</p>{!gmail.connected && <button onClick={connectGmail}>Connect Gmail</button>}</div>}

            </div>



            {selected && <article className="message-detail">

              <div className="detail-toolbar"><div><button className="detail-icon" aria-label="Archive in Gmail" onClick={() => void archive()} title="Archive"><Archive size={16} /></button><button className="detail-icon" aria-label="Snooze in Peony" onClick={() => void snooze()} title="Snooze"><Clock3 size={16} /></button><button className="detail-icon danger" aria-label="Move to Gmail Trash" onClick={() => void trash()} title="Move to Trash"><Trash2 size={16} /></button></div><div className="detail-menu-wrap"><button className="detail-icon" aria-label="More actions" onClick={() => setMoreOpen(!moreOpen)}><MoreHorizontal size={17} /></button>{moreOpen && <div className="detail-menu"><button onClick={() => void markRead(!selected.unread)}>{selected.unread ? "Mark as read" : "Mark as unread"}</button><button onClick={() => window.open(`https\://mail.google.com/mail/u/0/#all/${selected.gmail_thread_id ?? selected.id}`, "_blank")}>Open in Gmail <ExternalLink size={13} /></button></div>}</div></div>

              <div className="detail-content">

                <div className="detail-breadcrumb"><span>✿ {selected.garden}</span><span>·</span><span>{selected.category}</span>{selected.source === "gmail" && <><span>·</span><span>Gmail</span></>}</div>

                <h2>{selected.subject}</h2>

                <div className="sender-block"><SenderAvatar email={selected.sender_email} initials={selected.initials} accent={selected.accent} detail /><div><strong>{selected.sender}</strong><span>{selected.sender_email || "to you"} · {formatTime(selected.received_at)}</span></div><div className="detail-menu-wrap"><button className="detail-icon" aria-label="Change Garden" onClick={() => setTagOpen(!tagOpen)}><Tag size={16} /></button>{tagOpen && <div className="detail-menu tag-menu">{gardens.map((garden) => <button key={garden} onClick={() => void tagEmail(garden)}>✿ {garden}</button>)}</div>}</div></div>

                <EmailBody body={selected.body} fallback={selected.preview} />

                {selected.action && <div className="peony-suggestion"><div className="suggestion-head"><Sparkles size={15} /><strong>Peony noticed a next step</strong></div><p>{selected.action}</p></div>}

                <div className="reply-box"><div className="reply-box-top"><span><Send size={14} /> Reply through {selected.source === "gmail" ? "Gmail" : "Peony demo"}</span><button aria-label="Attach file" title="Attachments will be enabled with Gmail compose"><Paperclip size={15} /></button></div><textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply..." />{selected.sender === "Adam" && !reply && <button className="reply-fill" onClick={() => setReply("Hi Adam,\n\nThanks — I’ll send the onboarding document shortly.")}>Use a quick reply</button>}<div className="reply-box-bottom"><span className="reply-attachment"><FileText size={13} /> Gmail-safe text reply</span><button className="send-button" onClick={() => void sendReply()} disabled={!reply.trim() || sent}>{sent ? <><Check size={14} /> Sent</> : <><Send size={14} /> Send</>}</button></div></div>

              </div>

            </article>}

          </div>

        </section>

      </div>

    </main>

  );

}

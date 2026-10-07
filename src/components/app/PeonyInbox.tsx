"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  FileText,
  Inbox,
  Menu,
  MoreHorizontal,
  Paperclip,
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
};

type SeedEmail = Omit<Email, "id" | "status">;

const seedEmails: SeedEmail[] = [
  {
    sender: "Adam",
    initials: "AS",
    subject: "Employee onboarding document",
    preview: "Could you send the final onboarding document before today ends?",
    received_at: "2026-10-02T09:12:00+08:00",
    category: "Priority",
    garden: "Work",
    tag: "Reply ready",
    unread: true,
    accent: "rose",
    body: "Hi! Could you send the final employee onboarding document before the end of today? I need it for the new starter pack.",
    action: "Reply with the onboarding document",
  },
  {
    sender: "Northwind Studio",
    initials: "N",
    subject: "Your design engineer application",
    preview: "We'd love to move your application forward.",
    received_at: "2026-10-02T08:46:00+08:00",
    category: "Priority",
    garden: "Job Search",
    tag: "Interview tomorrow",
    unread: true,
    accent: "iris",
    body: "Thanks for applying. We'd love to move your design engineer application forward and meet tomorrow at 10:30 AM.",
    action: "Prepare for interview",
  },
  {
    sender: "Katherine",
    initials: "KY",
    subject: "Latest design proposal",
    preview: "Following up on the proposal we discussed last week.",
    received_at: "2026-10-01T15:30:00+08:00",
    category: "Priority",
    garden: "Work",
    tag: "Follow up",
    unread: false,
    accent: "butter",
    body: "Just checking whether you've had a chance to review the latest design proposal. Happy to answer any questions.",
    action: "Send a follow-up",
  },
  {
    sender: "Jason",
    initials: "JW",
    subject: "Weekly check-in moved to 3 PM",
    preview: "The calendar invite has been updated.",
    received_at: "2026-10-01T14:10:00+08:00",
    category: "Priority",
    garden: "Work",
    tag: "Time changed",
    unread: false,
    accent: "mint",
    body: "I've moved our weekly check-in to 3:00 PM. The calendar invite has been updated.",
    action: "Review calendar",
  },
  {
    sender: "Acme Security",
    initials: "AC",
    subject: "New sign-in detected",
    preview: "Chrome on Mac · Manila · 9:41 AM",
    received_at: "2026-10-01T09:41:00+08:00",
    category: "Updates",
    garden: "Security",
    tag: "Security",
    unread: false,
    accent: "iris",
    body: "A new sign-in was detected from Chrome on Mac. If this was you, no action is needed.",
    action: null,
  },
  {
    sender: "Delta",
    initials: "DL",
    subject: "Your SFO → JFK booking",
    preview: "Flight is on time · Fri 7:45 AM",
    received_at: "2026-09-25T08:00:00+08:00",
    category: "Updates",
    garden: "Travel",
    tag: "Booking",
    unread: false,
    accent: "mint",
    body: "Your flight from SFO to JFK is currently on time. Departure is Friday at 7:45 AM.",
    action: null,
  },
  {
    sender: "Parcel",
    initials: "P",
    subject: "Order A20 arriving Sep 26",
    preview: "Your package is on its way.",
    received_at: "2026-09-24T12:00:00+08:00",
    category: "Updates",
    garden: "Purchases",
    tag: "Delivery",
    unread: false,
    accent: "butter",
    body: "Your order A20 is on its way and is expected to arrive on September 26.",
    action: null,
  },
  {
    sender: "Apartment List",
    initials: "AL",
    subject: "1 new apartment application",
    preview: "A new listing matches your saved preferences.",
    received_at: "2026-09-23T10:00:00+08:00",
    category: "Later",
    garden: "Personal",
    tag: "Apartment",
    unread: false,
    accent: "rose",
    body: "A new apartment listing matches your saved preferences. Peony can add it to a Garden if you'd like to track it.",
    action: "Review the new listing",
  },
];

const navItems: { label: Category; icon: typeof Inbox }[] = [
  { label: "Priority", icon: Inbox },
  { label: "Updates", icon: Bell },
  { label: "Later", icon: Clock3 },
];

const gardens = ["Job Search", "Work", "Purchases", "Travel"];

function formatTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

export default function PeonyInbox() {
  const [category, setCategory] = useState<Category>("Priority");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cloudMode, setCloudMode] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isSupabaseConfigured()) {
        const local = seedEmails.map((email, index) => ({
          ...email,
          id: `local-${index + 1}`,
          status: "active" as EmailStatus,
        }));
        if (!cancelled) {
          setEmails(local);
          setSelectedId(local[0]?.id ?? null);
          setLoading(false);
        }
        return;
      }

      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        window.location.href = "/login?next=/app";
        return;
      }

      const { data, error } = await supabase
        .from("emails")
        .select("id,sender,initials,subject,preview,received_at,category,garden,tag,unread,accent,body,action,status")
        .order("received_at", { ascending: false });

      if (error) {
        console.error(error);
        if (!cancelled) setLoading(false);
        return;
      }

      if (data.length === 0) {
        // `user_id` is required by the emails table and is protected by RLS.
        // The seed objects intentionally omit it so the same demo data can
        // also be used in local mode; add the authenticated user's id here
        // before inserting into Supabase.
        const rowsToSeed = seedEmails.map((email) => ({
          ...email,
          user_id: authData.user.id,
        }));

        const { data: inserted, error: insertError } = await supabase
          .from("emails")
          .insert(rowsToSeed)
          .select("id,sender,initials,subject,preview,received_at,category,garden,tag,unread,accent,body,action,status")
          .order("received_at", { ascending: false });

        if (insertError) {
          // Don't throw from a client-side data loader. A console.error in
          // Next.js dev mode opens the error overlay, which makes a recoverable
          // database problem look like the whole page crashed.
          console.warn("Peony could not seed the starter inbox:", insertError.message);
          if (!cancelled) {
            setEmails([]);
            setSelectedId(null);
          }
        } else if (!cancelled) {
          const seeded = (inserted ?? []) as Email[];
          setEmails(seeded);
          setSelectedId(seeded[0]?.id ?? null);
        }
      } else if (!cancelled) {
        setEmails(data as Email[]);
        setSelectedId(data[0]?.id ?? null);
      }

      if (!cancelled) {
        setCloudMode(true);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return emails.filter((email) => {
      const matchesCategory = email.category === category;
      const matchesSearch =
        !q ||
        [email.sender, email.subject, email.preview, email.garden, email.tag]
          .join(" ")
          .toLowerCase()
          .includes(q);

      return matchesCategory && matchesSearch && email.status === "active";
    });
  }, [category, emails, query]);

  const selected =
    emails.find((email) => email.id === selectedId) ??
    filtered[0] ??
    emails[0] ??
    null;

  async function updateEmail(id: string, patch: Partial<Email>, actionKind?: string) {
    setEmails((current) =>
      current.map((email) => (email.id === id ? { ...email, ...patch } : email))
    );

    if (!cloudMode || id.startsWith("local-")) return;

    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;

    const { status: _status, ...dbPatch } = patch;
    const { error } = await supabase.from("emails").update(dbPatch).eq("id", id);
    if (error) console.warn("Peony could not update this email:", error.message);

    if (actionKind) {
      await supabase.from("email_actions").insert({
        user_id: authData.user.id,
        email_id: id,
        kind: actionKind,
      });
    }
  }

  async function markDone() {
    if (!selected) return;
    await updateEmail(selected.id, { status: "done", unread: false }, "archive");
    setSelectedId(filtered.find((email) => email.id !== selected.id)?.id ?? null);
  }

  async function snooze() {
    if (!selected) return;
    await updateEmail(selected.id, { status: "snoozed" }, "snooze");
    setSelectedId(filtered.find((email) => email.id !== selected.id)?.id ?? null);
  }

  async function markRead() {
    if (!selected || !selected.unread) return;
    await updateEmail(selected.id, { unread: false }, "mark_read");
  }

  async function sendReply() {
    if (!selected) return;
    setSent(true);

    if (cloudMode && !selected.id.startsWith("local-")) {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user) {
        await supabase.from("email_actions").insert({
          user_id: authData.user.id,
          email_id: selected.id,
          kind: "reply",
          detail: "Demo reply sent from Peony",
        });
      }
    }

    window.setTimeout(() => setSent(false), 2200);
  }

  async function signOut() {
    if (cloudMode) {
      await createClient().auth.signOut();
    }
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="inbox-loading">
        <span className="inbox-loading-flower">✿</span>
        <h1>Opening your inbox...</h1>
        <p>Peony is bringing the important things forward.</p>
      </main>
    );
  }

  return (
    <main className="inbox-app">
      <header className="inbox-topbar">
        <a className="inbox-brand" href="/">
          <span className="inbox-flower">✿</span>
          <span>Peony</span>
        </a>

        <div className="inbox-search">
          <Search size={16} />
          <input
            aria-label="Search your inbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your inbox..."
          />
          <kbd>⌘ K</kbd>
        </div>

        <div className="inbox-top-actions">
          <span className={`cloud-status ${cloudMode ? "is-cloud" : ""}`}>
            <span /> {cloudMode ? "Synced" : "Demo"}
          </span>
          <button className="icon-button" aria-label="Notifications"><Bell size={17} /></button>
          <button className="icon-button" aria-label="Settings"><Settings2 size={17} /></button>
          <button className="profile-avatar" onClick={signOut} title="Sign out">R</button>
        </div>

        <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Open menu">
          <Menu size={19} />
        </button>
      </header>

      <div className="inbox-layout">
        <aside className={`inbox-sidebar ${mobileOpen ? "is-open" : ""}`}>
          <div className="sidebar-close-row">
            <span>Your inbox</span>
            <button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={17} /></button>
          </div>

          <div className="inbox-nav-section">
            <span className="inbox-label">Inbox</span>
            {navItems.map(({ label, icon: Icon }) => {
              const count = emails.filter((email) => email.category === label && email.status === "active").length;
              return (
                <button
                  key={label}
                  className={`inbox-nav-item ${category === label ? "active" : ""}`}
                  onClick={() => { setCategory(label); setMobileOpen(false); }}
                >
                  <span><Icon size={15} />{label}</span>
                  <b>{count}</b>
                </button>
              );
            })}
          </div>

          <div className="inbox-nav-section">
            <span className="inbox-label">Gardens</span>
            {gardens.map((garden) => (
              <button key={garden} className="garden-nav-item" onClick={() => setQuery(garden)}>
                <span className="garden-dot">✿</span>{garden}
              </button>
            ))}
          </div>

          <div className="peony-tip">
            <Sparkles size={15} />
            <div>
              <strong>{cloudMode ? "Your inbox is synced." : "Peony is in demo mode."}</strong>
              <span>{cloudMode ? "Your actions persist in Supabase." : "Add Supabase keys to persist your inbox."}</span>
            </div>
          </div>

          <div className="sidebar-bottom">
            <a href="/">← Back to Peony</a>
          </div>
        </aside>

        <section className="inbox-main">
          <div className="inbox-heading">
            <div>
              <span className="inbox-kicker">Wednesday morning · {category}</span>
              <h1>{category === "Priority" ? "Good morning." : category}</h1>
              <p>
                {category === "Priority"
                  ? "Here’s what deserves your attention."
                  : category === "Updates"
                    ? "Peony summarized these so you can skim and go."
                    : "Kept out of your way until you go looking."}
              </p>
            </div>
            <button className="ask-peony-button"><Sparkles size={15} /> Ask Peony</button>
          </div>

          <div className="inbox-content">
            <div className="message-list-panel">
              <div className="list-toolbar">
                <span><b>{filtered.length}</b> messages</span>
                <button><ChevronDown size={14} /> Newest</button>
              </div>

              {filtered.map((email) => (
                <button
                  className={`message-row ${selected?.id === email.id ? "selected" : ""}`}
                  key={email.id}
                  onClick={() => {
                    setSelectedId(email.id);
                    setSent(false);
                    if (email.unread) {
                      void updateEmail(email.id, { unread: false }, "mark_read");
                    }
                  }}
                >
                  <span className={`message-avatar avatar-${email.accent}`}>{email.initials}</span>
                  <span className="message-row-copy">
                    <span className="message-row-top">
                      <strong>{email.sender}</strong>
                      <time>{formatTime(email.received_at)}</time>
                    </span>
                    <span className="message-subject">{email.subject}</span>
                    <span className="message-preview">{email.preview}</span>
                    <span className="message-meta">
                      <span className={`message-pill pill-${email.accent}`}>{email.tag}</span>
                      <span>✿ {email.garden}</span>
                    </span>
                  </span>
                  {email.unread && <span className="unread-dot" />}
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="empty-state">
                  <span>✿</span>
                  <h3>Nothing here.</h3>
                  <p>Try another search or let Peony keep the noise quiet.</p>
                </div>
              )}
            </div>

            {selected && (
              <article className="message-detail">
                <div className="detail-toolbar">
                  <div>
                    <button className="detail-icon" aria-label="Archive" onClick={() => void markDone()}><Archive size={16} /></button>
                    <button className="detail-icon" aria-label="Snooze" onClick={() => void snooze()}><Clock3 size={16} /></button>
                    <button className="detail-icon" aria-label="Delete"><Trash2 size={16} /></button>
                  </div>
                  <button className="detail-icon" aria-label="More"><MoreHorizontal size={17} /></button>
                </div>

                <div className="detail-content">
                  <div className="detail-breadcrumb"><span>✿ {selected.garden}</span><span>·</span><span>{selected.category}</span></div>
                  <h2>{selected.subject}</h2>

                  <div className="sender-block">
                    <span className={`detail-avatar avatar-${selected.accent}`}>{selected.initials}</span>
                    <div>
                      <strong>{selected.sender}</strong>
                      <span>to you · {formatTime(selected.received_at)}</span>
                    </div>
                    <button className="detail-icon" aria-label="Tag"><Tag size={16} /></button>
                  </div>

                  <p className="email-body">{selected.body}</p>

                  {selected.action && (
                    <div className="peony-suggestion">
                      <div className="suggestion-head"><Sparkles size={15} /><strong>Peony noticed a next step</strong></div>
                      <p>{selected.action}</p>
                    </div>
                  )}

                  <div className="reply-box">
                    <div className="reply-box-top">
                      <span><Send size={14} /> Reply</span>
                      <button aria-label="Attach file"><Paperclip size={15} /></button>
                    </div>
                    <textarea defaultValue={selected.sender === "Adam" ? "Hi Adam, attached below is the employee onboarding document." : ""} placeholder="Write a reply..." />
                    <div className="reply-box-bottom">
                      <span className="reply-attachment"><FileText size={13} /> Onboarding.pdf</span>
                      <button className="send-button" onClick={() => void sendReply()}>
                        {sent ? <><Check size={14} /> Sent</> : <><Send size={14} /> Send</>}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

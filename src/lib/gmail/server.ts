import crypto from "node:crypto";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

function env(name: string) {
  const value = process.env[name];
  return value?.trim() || undefined;
}

function serverKey() {
  return env("SUPABASE_SECRET_KEY") || env("SUPABASE_SERVICE_ROLE_KEY");
}

export function gmailServerKeyError() {
  const key = serverKey();
  if (!key) {
    return "Gmail setup needs attention: add SUPABASE_SECRET_KEY to .env.local and restart the dev server.";
  }
  if (key.startsWith("sb_publishable_")) {
    return "Gmail setup needs attention: SUPABASE_SECRET_KEY contains a publishable key. Use the Supabase secret key (sb_secret_…) on the server instead.";
  }
  if (key.startsWith("eyJ")) {
    return "Gmail setup needs attention: SUPABASE_SECRET_KEY contains a legacy JWT key. Use the current sb_secret_… key, or set SUPABASE_SERVICE_ROLE_KEY if you intentionally use the legacy service_role key.";
  }
  if (!key.startsWith("sb_secret_") && !key.startsWith("sb_publishable_")) {
    return "Gmail setup needs attention: the server key format is not recognized. Copy the Secret key (sb_secret_…) from Supabase → Settings → API Keys.";
  }
  return null;
}

export function gmailConfigured() {
  return Boolean(
    env("GOOGLE_CLIENT_ID") &&
      env("GOOGLE_CLIENT_SECRET") &&
      env("GMAIL_REDIRECT_URI") &&
      env("GMAIL_TOKEN_ENCRYPTION_KEY") &&
      serverKey()
  );
}

function requireEnv(name: string) {
  const value = env(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function admin() {
  const key = serverKey();
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SECRET_KEY. Add your Supabase secret key to .env.local, then restart the dev server."
    );
  }

  const publicUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const serverUrl = env("SUPABASE_URL");
  if (!publicUrl && !serverUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (publicUrl && serverUrl && publicUrl !== serverUrl) {
    throw new Error("Supabase URL mismatch: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_URL must point to the same project.");
  }
  const url = serverUrl || publicUrl!;

  // Keep this separate from the SSR client. Supabase recommends using the
  // plain supabase-js client with a secret/service_role key on the server.
  return createSupabaseAdmin(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function encryptionKey() {
  const raw = Buffer.from(requireEnv("GMAIL_TOKEN_ENCRYPTION_KEY"), "hex");
  if (raw.length !== 32) throw new Error("GMAIL_TOKEN_ENCRYPTION_KEY must be 64 hex characters");
  return raw;
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted Gmail token");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function randomState() {
  return crypto.randomBytes(32).toString("base64url");
}

export function buildAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requireEnv("GMAIL_REDIRECT_URI"),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    scope: GMAIL_SCOPES.join(" "),
  });
  return `${GMAIL_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code: string) {
  const response = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requireEnv("GMAIL_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description ?? payload.error ?? "Google OAuth exchange failed");
  return payload as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error_description ?? payload.error ?? "Google token refresh failed");
  return payload.access_token as string;
}

async function gmailFetch<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message ?? `Gmail API request failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export async function saveGmailConnection(userId: string, code: string) {
  const token = await exchangeCode(code);
  let refreshToken = token.refresh_token;

  if (!refreshToken) {
    const { data: existing } = await admin()
      .from("gmail_connections")
      .select("refresh_token_encrypted")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing?.refresh_token_encrypted) refreshToken = decryptSecret(existing.refresh_token_encrypted);
  }

  if (!refreshToken) throw new Error("Google did not return a refresh token. Reconnect and approve offline access.");

  const profile = await gmailFetch<{ emailAddress: string; historyId: string }>(token.access_token, "/users/me/profile");
  const db = admin();
  const { error } = await db.from("gmail_connections").upsert(
    {
      user_id: userId,
      gmail_address: profile.emailAddress,
      refresh_token_encrypted: encryptSecret(refreshToken),
      // The first sync performs an initial inbox snapshot, then records the
      // latest historyId. Starting from null prevents us from missing messages
      // that were already in the inbox before OAuth completed.
      last_history_id: null,
      last_synced_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) throw new Error(error.message);
  return profile.emailAddress;
}

async function connectionFor(userId: string) {
  const { data, error } = await admin()
    .from("gmail_connections")
    .select("user_id,gmail_address,refresh_token_encrypted,last_history_id,last_synced_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data;
}

export async function getGmailStatus(userId: string) {
  const connection = await connectionFor(userId);
  return connection
    ? { connected: true, email: connection.gmail_address, lastSyncedAt: connection.last_synced_at }
    : { connected: false, email: null, lastSyncedAt: null };
}

export async function withGmail<T>(userId: string, fn: (accessToken: string) => Promise<T>) {
  const connection = await connectionFor(userId);
  if (!connection) throw new Error("Gmail is not connected");
  const refreshToken = decryptSecret(connection.refresh_token_encrypted);
  const accessToken = await refreshAccessToken(refreshToken);
  return fn(accessToken);
}

function decodeBase64Url(value?: string) {
  if (!value) return "";
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
    rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
    ndash: "–", mdash: "—", hellip: "…", bull: "•", middot: "·",
    copy: "©", reg: "®", trade: "™", euro: "€", pound: "£", yen: "¥",
  };

  return value.replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/gi, (entity, token: string) => {
    const lower = token.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    }
    return named[lower] ?? entity;
  });
}

function normalizePlainText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(style|script|noscript|template|head)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<\/?(br|hr)\s*\/?\s*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n• ")
      .replace(/<\/?(p|div|section|article|header|footer|main|aside|blockquote|h[1-6]|tr)[^>]*>/gi, "\n")
      .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractText(payload: any): string {
  const plainParts: string[] = [];
  const htmlParts: string[] = [];

  function visit(part: any) {
    if (part?.body?.data) {
      const decoded = decodeBase64Url(part.body.data);
      if (part.mimeType === "text/plain") {
        const text = normalizePlainText(decoded);
        if (text) plainParts.push(text);
      } else if (part.mimeType === "text/html") {
        const text = stripHtml(decoded);
        if (text) htmlParts.push(text);
      }
    }

    for (const child of part?.parts ?? []) visit(child);
  }

  visit(payload);
  return plainParts[0] ?? htmlParts[0] ?? "";
}

function header(headers: any[], name: string) {
  return headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function initials(sender: string) {
  const match = sender.match(/\b([A-Za-z])[A-Za-z]*\s+([A-Za-z])[A-Za-z]*\b/);
  if (match) return `${match[1]}${match[2]}`.toUpperCase();
  return sender.replace(/<.*?>/g, "").trim().slice(0, 2).toUpperCase() || "?";
}

function senderName(value: string) {
  const cleaned = value.replace(/<[^>]+>/g, "").replace(/"/g, "").trim();
  return cleaned || value;
}

function categoryFor(labels: string[], subject: string) {
  if (labels.includes("UNREAD")) return "Priority" as const;
  if (/invoice|receipt|booking|delivery|newsletter|digest|alert/i.test(subject)) return "Updates" as const;
  return "Later" as const;
}

function gardenFor(subject: string, sender: string) {
  const text = `${subject} ${sender}`.toLowerCase();
  if (/job|application|interview|recruit|career|candidate/.test(text)) return "Job Search";
  if (/work|project|design|meeting|client|proposal|invoice|office/.test(text)) return "Work";
  if (/order|purchase|receipt|shipping|delivery|parcel|shop/.test(text)) return "Purchases";
  if (/flight|hotel|travel|booking|reservation|trip|airport/.test(text)) return "Travel";
  return "Personal";
}

export type SyncedEmail = {
  user_id: string;
  gmail_message_id: string;
  gmail_thread_id: string;
  sender: string;
  sender_email: string;
  initials: string;
  subject: string;
  preview: string;
  received_at: string;
  category: "Priority" | "Updates" | "Later";
  garden: string;
  tag: string;
  unread: boolean;
  accent: "rose" | "iris" | "mint" | "butter";
  body: string;
  action: string | null;
  gmail_label_ids: string[];
  source: "gmail";
};

export async function syncGmailInbox(userId: string, options: { repair?: boolean } = {}) {
  return withGmail(userId, async (accessToken) => {
    const db = admin();
    const { data: connection, error: connectionError } = await db
      .from("gmail_connections")
      .select("last_history_id")
      .eq("user_id", userId)
      .single();

    if (connectionError) throw new Error(connectionError.message);

    async function saveHistoryId(historyId?: string | null) {
      if (!historyId) return;
      const { error } = await db
        .from("gmail_connections")
        .update({
          last_history_id: historyId,
          last_synced_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    }

    async function upsertMessages(messageIds: string[]) {
      const uniqueIds = [...new Set(messageIds)].filter(Boolean);
      if (!uniqueIds.length) return 0;

      const fullResults = await Promise.all(
        uniqueIds.map(async (messageId) => {
          try {
            return await gmailFetch<any>(
              accessToken,
              `/users/me/messages/${encodeURIComponent(messageId)}?format=full`
            );
          } catch (error) {
            const status = error instanceof Error && "status" in error
              ? (error as Error & { status?: number }).status
              : undefined;
            if (status === 404) return null;
            throw error;
          }
        })
      );

      const deletedIds = fullResults
        .map((message, index) => message ? null : uniqueIds[index])
        .filter((messageId): messageId is string => Boolean(messageId));

      if (deletedIds.length) {
        const { error } = await db
          .from("emails")
          .update({ status: "done", unread: false })
          .eq("user_id", userId)
          .in("gmail_message_id", deletedIds);
        if (error) throw new Error(error.message);
      }

      const full = fullResults.filter(Boolean);
      const rows: SyncedEmail[] = full.map((message) => {
        const headers = message.payload?.headers ?? [];
        const from = header(headers, "From");
        const subject = header(headers, "Subject") || "(no subject)";
        const dateHeader = header(headers, "Date");
        const parsedDate = dateHeader ? new Date(dateHeader) : new Date(Number(message.internalDate));
        const body = extractText(message.payload) || message.snippet || "";
        const labels = message.labelIds ?? [];
        return {
          user_id: userId,
          gmail_message_id: message.id,
          gmail_thread_id: message.threadId,
          sender: senderName(from),
          sender_email: (from.match(/<([^>]+)>/)?.[1] ?? from).trim(),
          initials: initials(from),
          subject,
          preview: message.snippet ?? body.slice(0, 150),
          received_at: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
          category: categoryFor(labels, subject),
          garden: gardenFor(subject, from),
          tag: labels.includes("UNREAD") ? "New" : labels.includes("STARRED") ? "Starred" : "",
          unread: labels.includes("UNREAD"),
          accent: labels.includes("UNREAD") ? "rose" : "iris",
          body,
          action: null,
          gmail_label_ids: labels,
          source: "gmail",
        };
      });

      const idsOnly = rows.map((row) => row.gmail_message_id);
      const { data: existing, error: existingError } = await db
        .from("emails")
        .select("id,gmail_message_id,status")
        .eq("user_id", userId)
        .in("gmail_message_id", idsOnly);
      if (existingError) throw new Error(existingError.message);

      const existingMap = new Map((existing ?? []).map((row) => [row.gmail_message_id, row]));
      const newRows = rows.filter((row) => !existingMap.has(row.gmail_message_id));

      if (newRows.length) {
        const { error } = await db.from("emails").insert(newRows);
        if (error) throw new Error(error.message);
      }

      for (const row of rows) {
        const existingRow = existingMap.get(row.gmail_message_id);
        if (!existingRow) continue;

        const shouldBeDone = !row.gmail_label_ids.includes("INBOX") || row.gmail_label_ids.includes("TRASH");
        const nextStatus = existingRow.status === "snoozed"
          ? "snoozed"
          : shouldBeDone
            ? "done"
            : "active";

        const { error } = await db
          .from("emails")
          .update({
            sender: row.sender,
            sender_email: row.sender_email,
            initials: row.initials,
            subject: row.subject,
            preview: row.preview,
            received_at: row.received_at,
            category: row.category,
            garden: row.garden,
            tag: row.tag,
            unread: row.unread,
            accent: row.accent,
            body: row.body,
            gmail_thread_id: row.gmail_thread_id,
            gmail_label_ids: row.gmail_label_ids,
            source: "gmail",
            status: nextStatus,
          })
          .eq("id", existingRow.id);
        if (error) throw new Error(error.message);
      }

      return rows.length;
    }

    // One-time repair path used after the message parser changes. It refreshes
    // the current inbox snapshot without changing the incremental history cursor.
    if (options.repair) {
      const listed = await gmailFetch<{ messages?: { id: string; threadId: string }[] }>(
        accessToken,
        "/users/me/messages?labelIds=INBOX&maxResults=100"
      );
      const count = await upsertMessages((listed.messages ?? []).map((message) => message.id));
      return { count, email: null, mode: "repair" as const };
    }

    // First sync: take a small inbox snapshot. Subsequent syncs use Gmail
    // history so we do not repeatedly download the same 50 messages.
    if (!connection.last_history_id) {
      const listed = await gmailFetch<{ messages?: { id: string; threadId: string }[]; resultSizeEstimate?: number }>(
        accessToken,
        "/users/me/messages?labelIds=INBOX&maxResults=50"
      );
      const count = await upsertMessages((listed.messages ?? []).map((message) => message.id));
      const profile = await gmailFetch<{ historyId: string }>(accessToken, "/users/me/profile");
      await saveHistoryId(profile.historyId);
      return { count, email: null, mode: "initial" as const };
    }

    try {
      const history = await gmailFetch<{
        history?: Array<{
          messages?: { id: string }[];
          messagesAdded?: Array<{ message?: { id: string } }>;
          messagesDeleted?: Array<{ message?: { id: string } }>;
          labelsAdded?: Array<{ message?: { id: string } }>;
          labelsRemoved?: Array<{ message?: { id: string } }>;
        }>;
        historyId?: string;
        nextPageToken?: string;
      }>(
        accessToken,
        `/users/me/history?startHistoryId=${encodeURIComponent(connection.last_history_id)}&historyTypes=messageAdded&historyTypes=messageDeleted&historyTypes=labelAdded&historyTypes=labelRemoved`
      );

      const ids = new Set<string>();
      for (const historyEntry of history.history ?? []) {
        for (const message of historyEntry.messages ?? []) {
          if (message.id) ids.add(message.id);
        }
        for (const added of historyEntry.messagesAdded ?? []) {
          if (added.message?.id) ids.add(added.message.id);
        }
        for (const deleted of historyEntry.messagesDeleted ?? []) {
          if (deleted.message?.id) ids.add(deleted.message.id);
        }
        for (const addedLabel of historyEntry.labelsAdded ?? []) {
          if (addedLabel.message?.id) ids.add(addedLabel.message.id);
        }
        for (const removedLabel of historyEntry.labelsRemoved ?? []) {
          if (removedLabel.message?.id) ids.add(removedLabel.message.id);
        }
      }

      const count = await upsertMessages([...ids]);
      await saveHistoryId(history.historyId ?? connection.last_history_id);
      return { count, email: null, mode: "incremental" as const };
    } catch (error) {
      // Gmail history expires. A 404 means the stored cursor can no longer be
      // used, so safely rebuild the inbox snapshot instead of getting stuck.
      const status = error instanceof Error && "status" in error
        ? (error as Error & { status?: number }).status
        : undefined;
      if (status !== 404) throw error;

      const listed = await gmailFetch<{ messages?: { id: string; threadId: string }[] }>(
        accessToken,
        "/users/me/messages?labelIds=INBOX&maxResults=50"
      );
      const count = await upsertMessages((listed.messages ?? []).map((message) => message.id));
      const profile = await gmailFetch<{ historyId: string }>(accessToken, "/users/me/profile");
      await saveHistoryId(profile.historyId);
      return { count, email: null, mode: "recovered" as const };
    }
  });
}

export async function gmailMessageAction(
  userId: string,
  messageId: string,
  action: "archive" | "delete" | "mark_read" | "mark_unread" | "send_reply",
  detail?: { body?: string; to?: string; subject?: string; threadId?: string }
) {
  return withGmail(userId, async (accessToken) => {
    if (action === "archive") {
      await gmailFetch(accessToken, `/users/me/messages/${encodeURIComponent(messageId)}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
      });
    } else if (action === "delete") {
      await gmailFetch(accessToken, `/users/me/messages/${encodeURIComponent(messageId)}/trash`, { method: "POST" });
    } else if (action === "mark_read" || action === "mark_unread") {
      await gmailFetch(accessToken, `/users/me/messages/${encodeURIComponent(messageId)}/modify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "mark_read" ? { removeLabelIds: ["UNREAD"] } : { addLabelIds: ["UNREAD"] }),
      });
    } else if (action === "send_reply") {
      if (!detail?.to || !detail.body) throw new Error("Reply recipient and body are required");
      const subject = detail.subject?.startsWith("Re:") ? detail.subject : `Re: ${detail.subject ?? ""}`;
      const lines = [
        `To: ${detail.to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=UTF-8",
        "MIME-Version: 1.0",
        "",
        detail.body,
      ];
      const raw = Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
      await gmailFetch(accessToken, "/users/me/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, threadId: detail.threadId }),
      });
    }

    return { ok: true };
  });
}

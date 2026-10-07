import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gmailMessageAction } from "@/lib/gmail/server";

const allowed = new Set(["archive", "delete", "mark_read", "mark_unread", "send_reply"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  if (!body.messageId || !allowed.has(body.action)) {
    return NextResponse.json({ error: "Invalid Gmail action" }, { status: 400 });
  }

  try {
    const result = await gmailMessageAction(data.user.id, body.messageId, body.action, body.detail);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gmail action failed" }, { status: 500 });
  }
}

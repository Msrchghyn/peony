import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncGmailInbox } from "@/lib/gmail/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const url = new URL(request.url);
    const repair = url.searchParams.get("repair") === "1";
    const result = await syncGmailInbox(data.user.id, { repair });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail sync failed";
    const status = /not connected/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

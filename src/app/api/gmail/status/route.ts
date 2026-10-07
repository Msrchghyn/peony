import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGmailStatus, gmailServerKeyError } from "@/lib/gmail/server";

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ connected: false }, { status: 401 });
  const setupError = gmailServerKeyError();
  if (setupError) {
    return NextResponse.json(
      { connected: false, configured: false, code: "supabase_server_key_invalid", error: setupError },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json({ configured: true, ...(await getGmailStatus(data.user.id)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read Gmail status";
    const invalidKey = /invalid api key|api key|unauthorized|401/i.test(message);
    return NextResponse.json(
      {
        connected: false,
        configured: false,
        code: invalidKey ? "supabase_server_key_invalid" : "gmail_status_error",
        error: invalidKey
          ? "Gmail setup needs attention: Supabase rejected the server key. Verify that SUPABASE_SECRET_KEY is the sb_secret_… key for the same project as NEXT_PUBLIC_SUPABASE_URL, then restart Next.js."
          : message,
      },
      { status: invalidKey ? 503 : 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { gmailConfigured, saveGmailConnection } from "@/lib/gmail/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const origin = url.origin;

  if (error) return NextResponse.redirect(`${origin}/app?gmail_error=${encodeURIComponent(error)}`);
  if (!gmailConfigured() || !code || !state) {
    return NextResponse.redirect(`${origin}/app?gmail_error=missing_oauth_response`);
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("peony_gmail_oauth_state")?.value;
  if (!data.user || !expectedState || expectedState !== state) {
    return NextResponse.redirect(`${origin}/app?gmail_error=invalid_oauth_state`);
  }

  try {
    await saveGmailConnection(data.user.id, code);
    const response = NextResponse.redirect(`${origin}/app?gmail_connected=1`);
    response.cookies.delete("peony_gmail_oauth_state");
    return response;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not connect Gmail";
    return NextResponse.redirect(`${origin}/app?gmail_error=${encodeURIComponent(message)}`);
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizationUrl, gmailConfigured, randomState } from "@/lib/gmail/server";

export async function GET(request: Request) {
  if (!gmailConfigured()) {
    return NextResponse.json({ error: "Gmail integration is not configured yet." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login?next=/app", request.url));

  const state = randomState();
  const response = NextResponse.redirect(buildAuthorizationUrl(state));
  response.cookies.set("peony_gmail_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}

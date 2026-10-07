"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Flower2, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export default function ConfirmPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Confirming your email…");

  useEffect(() => {
    let active = true;

    async function confirm() {
      const url = new URL(window.location.href);
      const next = safeNext(url.searchParams.get("next"));
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const supabase = createClient();

      const queryError = url.searchParams.get("error_description");
      const hashError = hash.get("error_description");
      const errorDescription = queryError || hashError;

      if (errorDescription) {
        if (!active) return;
        setStatus("error");
        setMessage(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
        return;
      }

      try {
        // Recommended SSR flow: a custom Supabase email can send token_hash.
        const tokenHash = url.searchParams.get("token_hash");
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "email",
          });
          if (error) throw error;
        } else {
          // Default Supabase hosted email uses the implicit flow and returns
          // the session in the URL fragment. Support that flow too.
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
          throw new Error(
            "This confirmation link has expired or is incomplete. Please request a new confirmation email."
          );
        }

        if (!active) return;
        setStatus("success");
        setMessage("Your email is confirmed. Opening your Peony inbox…");

        // Give the browser a moment to persist the SSR auth cookies before
        // requesting the protected /app route.
        window.setTimeout(() => {
          window.location.replace(next);
        }, 250);
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "We couldn't confirm your email.");
      }
    }

    void confirm();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="auth-shell auth-confirm-shell">
      <div className="auth-orbit" aria-hidden="true" />
      <a href="/" className="auth-brand">
        <span>✿</span> Peony
      </a>

      <section className="auth-card auth-confirm-card">
        <div className="auth-flower">
          {status === "loading" ? <LoaderCircle className="spin" size={25} /> : <Flower2 size={25} />}
        </div>
        <span className="auth-kicker">Your inbox, in bloom.</span>
        <h1>{status === "error" ? "One little hiccup." : status === "success" ? "You're in." : "Just a moment."}</h1>
        <p>{message}</p>

        {status === "error" && (
          <a className="auth-submit auth-confirm-link" href="/login">
            Back to Peony <ArrowRight size={16} />
          </a>
        )}
      </section>

      <p className="auth-footnote">Built as a free-first portfolio project.</p>
    </main>
  );
}

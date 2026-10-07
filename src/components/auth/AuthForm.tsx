"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [canResend, setCanResend] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setCanResend(false);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            setCanResend(true);
          }
          throw error;
        }
        window.location.href = "/app";
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/app`,
        },
      });

      if (error) throw error;

      if (data.session) {
        window.location.href = "/app";
      } else {
        setCanResend(true);
        setMessage(
          "Account created. Check your email to confirm your address, then come back and sign in."
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function resendConfirmation() {
    if (!email) return;
    setLoading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/app`,
        },
      });
      if (error) throw error;
      setMessage("A fresh confirmation email is on its way. Please use the newest link.");
      setCanResend(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't resend the confirmation email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-orbit" aria-hidden="true" />
      <a href="/" className="auth-brand">
        <span>✿</span> Peony
      </a>

      <section className="auth-card">
        <div className="auth-flower">✿</div>
        <span className="auth-kicker"><Sparkles size={13} /> Your inbox, in bloom.</span>
        <h1>{mode === "signin" ? "Welcome back." : "Make room for what matters."}</h1>
        <p>
          {mode === "signin"
            ? "Sign in to your Peony inbox."
            : "Create your free Peony account. No subscription needed."}
        </p>

        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <span className="password-wrap">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>

          <button className="auth-submit" disabled={loading}>
            {loading ? "Opening Peony..." : mode === "signin" ? "Open my inbox" : "Create my account"}
            <ArrowRight size={16} />
          </button>
        </form>

        {message && (
          <div className="auth-message">
            <div>{message}</div>
            {canResend && (
              <button className="auth-resend" type="button" onClick={resendConfirmation} disabled={loading}>
                Resend confirmation email
              </button>
            )}
          </div>
        )}

        <button
          className="auth-switch"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage("");
            setCanResend(false);
          }}
        >
          {mode === "signin"
            ? "New to Peony? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </section>

      <p className="auth-footnote">Built as a free-first portfolio project.</p>
    </main>
  );
}

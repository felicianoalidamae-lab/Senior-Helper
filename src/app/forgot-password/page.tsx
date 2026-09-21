"use client";

import { useState } from "react";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/client";
import { ErrorText } from "@/components/error-text";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/accept-invite`,
    });
    setLoading(false);
    if (error) {
      setError("Couldn't send the reset email. Check your connection and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <Logo className="h-11 w-auto" />
      <div className="card w-full max-w-sm">
        <h1 className="text-lg font-semibold text-ink">Reset your password</h1>
        {sent ? (
          <p className="mt-3 text-muted">
            If an account exists for that email, we sent a link to reset the password.
          </p>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label className="label mt-4" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <ErrorText message={error} />
            <button type="submit" disabled={loading} className="btn-primary mt-5 w-full">
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}
        <a href="/login" className="mt-3 block text-center text-sm text-brand-blue hover:underline">
          Back to sign in
        </a>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import styles from "../page.module.css";

import { useAuth } from "@/components/auth-provider";
import { signIn, signUp } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", pin: "" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const functionsBaseUrl = useMemo(() => {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    return projectId ? `https://us-central1-${projectId}.cloudfunctions.net` : null;
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (!functionsBaseUrl) {
        throw new Error("Missing project configuration for functions");
      }
      if (!form.pin.trim()) {
        throw new Error("PIN is required");
      }

      const cred =
        mode === "signin"
          ? await signIn(form.email, form.password)
          : await signUp(form.email, form.password);

      const token = await cred.user.getIdToken();
      const res = await fetch(`${functionsBaseUrl}/saveTvdbPin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin: form.pin.trim() }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload?.message || "Failed to save PIN");
      }

      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <p>Loading...</p>
      </main>
    );
  }

  if (user) {
    router.replace("/");
    return null;
  }

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <h1>{mode === "signin" ? "Sign in" : "Create account"}</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </label>
          <label className={styles.label}>
            Password
            <div className={styles.passwordRow}>
              <input
                className={`${styles.input} ${styles.passwordInput}`}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <label className={styles.label}>
            TheTVDB PIN
            <input
              className={styles.input}
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
              placeholder="PIN from TheTVDB"
              required
            />
          </label>
          <button className={styles.buttonPrimary} type="submit" disabled={submitting}>
            {submitting ? "Working..." : mode === "signin" ? "Sign in" : "Sign up"}
          </button>
        </form>
        {error && <p className={styles.error}>{error}</p>}
        <p className={styles.muted}>
          {mode === "signin" ? (
            <>
              Need an account?{" "}
              <button className={styles.linkButton} onClick={() => setMode("signup")}>
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className={styles.linkButton} onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </p>
        <p className={styles.muted}>
          <Link href="/">Back to app</Link>
        </p>
      </div>
    </main>
  );
}

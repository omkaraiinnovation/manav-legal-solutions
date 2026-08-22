"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, LogIn, UserPlus } from "lucide-react";

const inputClass = "w-full rounded-[8px] border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-[var(--oxblood)]";
const inputStyle = { borderColor: "var(--hairline)" };

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        router.push(nextPath || "/");
        router.refresh();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: fullName || undefined } },
        });
        if (signUpError) throw signUpError;
        setSignupDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (signupDone) {
    return (
      <div className="paper-card animate-rise p-6 text-center">
        <p className="text-sm">
          Account created for <strong>{email}</strong>. If email confirmation is enabled on this project, check your
          inbox to confirm before signing in; otherwise you can sign in immediately.
        </p>
        <button onClick={() => { setSignupDone(false); setMode("login"); }} className="mt-4 text-sm font-medium" style={{ color: "var(--oxblood)" }}>
          Go to sign in →
        </button>
      </div>
    );
  }

  return (
    <div className="paper-card premium-sheen p-6">
      <div className="mb-5 flex rounded-[8px] border p-1" style={{ borderColor: "var(--hairline)" }}>
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="flex-1 rounded-[6px] py-1.5 text-sm font-medium transition-all duration-150"
            style={
              mode === m
                ? { backgroundImage: "linear-gradient(160deg, var(--oxblood) 0%, var(--oxblood-deep) 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)", color: "white" }
                : { color: "var(--ink-soft)" }
            }
          >
            {m === "login" ? "Sign In" : "Create Account"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3.5">
        {mode === "signup" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Full Name</span>
            <input className={inputClass} style={inputStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Adv. Priya Sharma" />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Email</span>
          <input type="email" required className={inputClass} style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@manavlegalsolutions.com" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Password</span>
          <input type="password" required minLength={6} className={inputClass} style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </label>

        {error && (
          <div className="rounded-[8px] px-3 py-2 text-xs" style={{ background: "var(--flagged-tint)", color: "var(--flagged)" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-[8px] py-2.5 text-sm font-medium text-white transition-transform duration-150 hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
          style={{
            backgroundImage: "linear-gradient(160deg, var(--oxblood) 0%, var(--oxblood-deep) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16), 0 6px 16px color-mix(in srgb, var(--oxblood) 30%, transparent)",
          }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : mode === "login" ? <LogIn size={15} /> : <UserPlus size={15} />}
          {mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-ink-faint">
        New accounts start with client-level access. Firm staff roles (advocate, paralegal, firm admin) are assigned
        by a platform administrator after signup.
      </p>
    </div>
  );
}

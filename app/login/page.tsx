import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3.5 text-center animate-rise">
          <div
            className="seal-ring flex h-14 w-14 items-center justify-center text-lg font-bold font-display"
            style={{ color: "var(--brass)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--brass) 12%, transparent), 0 8px 24px color-mix(in srgb, var(--brass) 18%, transparent)" }}
          >
            MLS
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Manav Legal Solutions</h1>
            <p className="mt-1 text-xs uppercase tracking-[0.14em] text-ink-faint">Pan-India Paralegal OS</p>
          </div>
        </div>
        <div className="animate-rise" style={{ animationDelay: "80ms" }}>
          <LoginForm nextPath={next} />
        </div>
      </div>
    </div>
  );
}

import { LoginForm } from "@/components/auth/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--paper)" }}>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="seal-ring flex h-12 w-12 items-center justify-center text-base font-bold font-display" style={{ color: "var(--brass)" }}>
            MLS
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold">Manav Legal Solutions</h1>
            <p className="text-xs text-ink-faint">Pan-India Paralegal OS</p>
          </div>
        </div>
        <LoginForm nextPath={next} />
      </div>
    </div>
  );
}

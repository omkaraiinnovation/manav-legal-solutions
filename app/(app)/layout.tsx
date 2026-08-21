import { Sidebar } from "@/components/shell/Sidebar";
import { getCurrentUser } from "@/lib/session";

/** Layout for every authenticated route (everything except /login). This is
 *  the only place getCurrentUser() is called unconditionally — it redirects
 *  to /login when there's no session, which is safe here because /login
 *  itself lives outside this route group and never renders through it. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={user.role} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

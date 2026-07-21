import { Header } from "@/components/layout/header";

/**
 * Dashboard Layout — includes header/sidebar
 * Used for session setup and post-session views
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#fafcfd] text-foreground font-sans selection:bg-primary/20 selection:text-primary relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white via-[#fafcfd] to-[#fafcfd] -z-10" />
      <Header />
      <main className="flex-1 w-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
        {children}
      </main>
    </div>
  );
}

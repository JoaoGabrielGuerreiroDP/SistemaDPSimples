import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { WeeklyBillsPopup } from "@/components/WeeklyBillsPopup";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 h-11 flex items-center gap-2 border-b border-border/50 bg-background/80 backdrop-blur-md px-2">
            <SidebarTrigger />
            <NotificationBell />
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
      <WeeklyBillsPopup />
    </SidebarProvider>
  );
}

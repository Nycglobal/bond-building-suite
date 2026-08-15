import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/AdminSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-secondary/30">
        <AdminSidebar onSignOut={signOut} />
        <SidebarInset className="bg-secondary/30">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-background px-4">
            <SidebarTrigger className="text-muted-foreground hover:text-primary" />
            <span className="text-xs tracking-[0.3em] text-muted-foreground uppercase">Admin</span>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
            <h1 className="mb-8 text-3xl text-primary">{title}</h1>
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { CustomerSidebar } from "@/components/CustomerSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";

export function useCategories() {
  return useQuery({
    queryKey: ["categories", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, display_order")
        .eq("active", true)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCartCount() {
  return useQuery({
    queryKey: ["cart-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cart_items")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function CustomerShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { account } = useAccount();
  const categories = useCategories();
  const cartCount = useCartCount();

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <div className="print:hidden">
          <CustomerSidebar
            categories={categories.data ?? []}
            cartCount={cartCount.data ?? 0}
            onSignOut={signOut}
          />
        </div>
        <SidebarInset className="bg-background">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-4 print:hidden">
            <SidebarTrigger className="text-muted-foreground hover:text-primary" />
            <span className="text-xs tracking-[0.15em] text-muted-foreground uppercase">
              {account?.customer?.company_name ?? ""}
            </span>
          </header>
          <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 lg:py-10 print:mx-0 print:max-w-none print:p-0">
            {children}
          </main>
          <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground print:hidden">
            © {new Date().getFullYear()} Jewel Brillance NYC · Wholesale only
          </footer>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

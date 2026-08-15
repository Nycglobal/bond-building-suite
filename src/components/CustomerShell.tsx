import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
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
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <Link to="/catalog">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {account?.customer?.company_name ?? ""}
            </span>
            <Button asChild variant="outline" size="sm">
              <Link to="/my-order">
                My Catalog Order
                {(cartCount.data ?? 0) > 0 ? ` (${cartCount.data})` : ""}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Sign Out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 pb-4 text-xs tracking-[0.18em] uppercase">
          <Link
            to="/catalog"
            search={{ category: undefined, q: undefined }}
            activeOptions={{ exact: true, includeSearch: true }}
            activeProps={{ className: "text-primary border-b border-accent" }}
            className="pb-1 text-muted-foreground transition-colors hover:text-primary"
          >
            All Jewelry
          </Link>
          {(categories.data ?? []).map((category) => (
            <Link
              key={category.id}
              to="/catalog"
              search={{ category: category.id, q: undefined }}
              activeOptions={{ includeSearch: true }}
              activeProps={{ className: "text-primary border-b border-accent" }}
              className="pb-1 text-muted-foreground transition-colors hover:text-primary"
            >
              {category.name}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Jewel Brillance NYC · Wholesale only
      </footer>
    </div>
  );
}

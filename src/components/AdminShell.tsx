import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/admin", label: "Dashboard", exact: true },
  { to: "/admin/products", label: "Products", exact: false },
  { to: "/admin/categories", label: "Categories", exact: false },
  { to: "/admin/customers", label: "Customers", exact: false },
  { to: "/admin/orders", label: "Orders", exact: false },
  { to: "/admin/settings", label: "Settings", exact: false },
] as const;

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-secondary/30">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <BrandMark size="sm" />
            <span className="text-[0.6rem] tracking-[0.3em] text-muted-foreground uppercase">
              Admin
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Sign Out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-7xl flex-wrap gap-x-6 gap-y-2 px-4 pb-3 text-xs tracking-[0.15em] uppercase">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              activeProps={{ className: "text-primary border-b border-accent" }}
              className="pb-1 text-muted-foreground transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <h1 className="mb-8 text-3xl text-primary">{title}</h1>
        {children}
      </main>
    </div>
  );
}

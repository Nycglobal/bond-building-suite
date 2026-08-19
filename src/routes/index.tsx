import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/account";
import { fetchAccount } from "@/hooks/useAccount";
import { registerSession } from "@/lib/customers.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign In — Jewel Brillance NYC Wholesale" },
      {
        name: "description",
        content:
          "Private sign-in for approved Jewel Brillance NYC wholesale accounts. Browse the diamond jewelry catalog and place catalog orders.",
      },
      { property: "og:title", content: "Sign In — Jewel Brillance NYC Wholesale" },
      {
        property: "og:description",
        content: "Private sign-in for approved Jewel Brillance NYC wholesale accounts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchAccount().then((account) => {
      if (cancelled || !account) return;
      void navigate({ to: account.isAdmin ? "/admin" : "/catalog" });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Enter your username and password");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) {
      setBusy(false);
      toast.error("Invalid username or password");
      return;
    }

    // Register this sign-in as the account's active session (single-session rule).
    try {
      await registerSession();
    } catch {
      // Registration failure should not block login; enforcement is best-effort.
    }

    const account = await fetchAccount();
    if (account && !account.isAdmin && account.customer && !account.customer.active) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("This account is inactive. Please contact Jewel Brillance NYC.");
      return;
    }
    setBusy(false);
    void navigate({ to: account?.isAdmin ? "/admin" : "/catalog" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <BrandMark size="lg" />
        </div>
        <div className="border border-border bg-background p-8 shadow-sm">
          <h1 className="mb-1 text-center text-xl text-primary">Wholesale Access</h1>
          <p className="mb-8 text-center text-sm text-muted-foreground">
            Accounts are issued by Jewel Brillance NYC.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                autoComplete="username"
                maxLength={40}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                maxLength={72}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          First time setting up the store?{" "}
          <Link to="/setup" className="underline underline-offset-4">
            Create the administrator account
          </Link>
        </p>
      </div>
    </main>
  );
}

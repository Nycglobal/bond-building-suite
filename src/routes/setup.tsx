import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminExists, createFirstAdmin } from "@/lib/customers.functions";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/account";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Store Setup — Jewel Brillance NYC" },
      {
        name: "description",
        content: "One-time administrator setup for the Jewel Brillance NYC wholesale catalog.",
      },
      { property: "og:title", content: "Store Setup — Jewel Brillance NYC" },
      {
        property: "og:description",
        content: "One-time administrator setup for the Jewel Brillance NYC wholesale catalog.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const existing = useQuery({ queryKey: ["admin-exists"], queryFn: () => adminExists() });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createFirstAdmin({ data: { username, password } });
      await supabase.auth.signInWithPassword({
        email: usernameToEmail(username),
        password,
      });
      toast.success("Administrator account created");
      void navigate({ to: "/admin" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/40 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <BrandMark size="lg" />
        </div>
        <div className="border border-border bg-background p-8 shadow-sm">
          <h1 className="mb-6 text-center text-xl text-primary">Administrator Setup</h1>
          {existing.data?.exists ? (
            <p className="text-center text-sm text-muted-foreground">
              An administrator already exists for this store. Please sign in from the home page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-username">Admin username</Label>
                <Input
                  id="admin-username"
                  value={username}
                  maxLength={40}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  maxLength={72}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Creating…" : "Create Administrator"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Jewel Brillance NYC Admin" },
      {
        name: "description",
        content: "Set the wholesale email address that receives new catalog orders.",
      },
      { property: "og:title", content: "Settings — Jewel Brillance NYC Admin" },
      { property: "og:description", content: "Wholesale email and company settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSettings,
});

function AdminSettings() {
  const queryClient = useQueryClient();
  const [wholesaleEmail, setWholesaleEmail] = useState("");
  const [companyName, setCompanyName] = useState("");

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("id, wholesale_email, company_name")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!settings.data) return;
    setWholesaleEmail(settings.data.wholesale_email);
    setCompanyName(settings.data.company_name);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("settings")
        .update({
          wholesale_email: wholesaleEmail.trim(),
          company_name: companyName.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  return (
    <AdminShell title="Settings">
      <form
        className="max-w-lg space-y-5 border border-border bg-background p-6"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="company_name">Company name</Label>
          <Input
            id="company_name"
            maxLength={120}
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wholesale_email">Wholesale order email</Label>
          <Input
            id="wholesale_email"
            type="email"
            maxLength={255}
            value={wholesaleEmail}
            onChange={(e) => setWholesaleEmail(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Every submitted catalog order is sent to this address and a confirmation is sent to the
            customer email. Resend must be configured on the server.
          </p>
          <p className="text-xs text-muted-foreground">
            Keep the Resend API key out of this form. Add it as the server environment variable
            <code className="ml-1 text-primary">RESEND_API_KEY</code>.
          </p>
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save Settings"}
        </Button>
      </form>
    </AdminShell>
  );
}

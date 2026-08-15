import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  createCustomer,
  deleteCustomer,
  setCustomerPassword,
  updateCustomer,
} from "@/lib/customers.functions";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — Jewel Brillance NYC Admin" },
      {
        name: "description",
        content: "Create wholesale logins, update account details and deactivate customers.",
      },
      { property: "og:title", content: "Customers — Jewel Brillance NYC Admin" },
      { property: "og:description", content: "Manage wholesale customer logins and details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCustomers,
});

type CustomerRow = {
  id: string;
  company_name: string;
  customer_name: string;
  email: string;
  phone: string | null;
  username: string;
  active: boolean;
};

const emptyForm = {
  company_name: "",
  customer_name: "",
  email: "",
  phone: "",
  username: "",
  password: "",
  active: true,
};

function AdminCustomers() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [passwordFor, setPasswordFor] = useState<CustomerRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const customers = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, company_name, customer_name, email, phone, username, active")
        .order("company_name");
      if (error) throw error;
      return (data ?? []) as CustomerRow[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-customers"] });

  const save = useMutation({
    mutationFn: async () => {
      if (editing) {
        await updateCustomer({
          data: {
            id: editing.id,
            company_name: form.company_name,
            customer_name: form.customer_name,
            email: form.email,
            phone: form.phone,
            username: form.username,
            active: form.active,
          },
        });
      } else {
        await createCustomer({ data: form });
      }
    },
    onSuccess: () => {
      void invalidate();
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success("Customer saved");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save"),
  });

  const toggleActive = useMutation({
    mutationFn: async (row: CustomerRow) => {
      const { error } = await supabase
        .from("customers")
        .update({ active: !row.active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteCustomer({ data: { id } }),
    onSuccess: () => {
      void invalidate();
      toast.success("Customer removed");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete"),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!passwordFor) return;
      await setCustomerPassword({ data: { id: passwordFor.id, password: newPassword } });
    },
    onSuccess: () => {
      setPasswordFor(null);
      setNewPassword("");
      toast.success("Password updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update"),
  });

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(row: CustomerRow) {
    setEditing(row);
    setForm({
      company_name: row.company_name,
      customer_name: row.customer_name,
      email: row.email,
      phone: row.phone ?? "",
      username: row.username,
      password: "",
      active: row.active,
    });
    setOpen(true);
  }

  return (
    <AdminShell title="Customers">
      <div className="mb-6 flex justify-between">
        <p className="text-sm text-muted-foreground">
          Customers cannot register themselves — every login is created here.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startCreate}>Add Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Customer" : "Add Customer"}</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="company">Company name</Label>
                <Input
                  id="company"
                  required
                  maxLength={120}
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact">Customer name</Label>
                <Input
                  id="contact"
                  required
                  maxLength={120}
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cust-email">Email</Label>
                  <Input
                    id="cust-email"
                    type="email"
                    required
                    maxLength={255}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cust-phone">Phone</Label>
                  <Input
                    id="cust-phone"
                    maxLength={40}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="cust-username">Username</Label>
                  <Input
                    id="cust-username"
                    required
                    maxLength={40}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                  />
                </div>
                {!editing && (
                  <div className="space-y-2">
                    <Label htmlFor="cust-password">Password</Label>
                    <Input
                      id="cust-password"
                      required
                      minLength={8}
                      maxLength={72}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="cust-active"
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: checked })}
                />
                <Label htmlFor="cust-active">Account active</Label>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save Customer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
            <tr>
              <th className="p-4">Company</th>
              <th className="p-4">Contact</th>
              <th className="p-4">Username</th>
              <th className="p-4">Active</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(customers.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No customers yet.
                </td>
              </tr>
            ) : (
              (customers.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="p-4">{row.company_name}</td>
                  <td className="p-4">
                    <div>{row.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{row.email}</div>
                  </td>
                  <td className="p-4">{row.username}</td>
                  <td className="p-4">
                    <Switch checked={row.active} onCheckedChange={() => toggleActive.mutate(row)} />
                  </td>
                  <td className="space-x-4 p-4 text-right text-xs tracking-[0.15em] uppercase">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => setPasswordFor(row)}
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove.mutate(row.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(passwordFor)} onOpenChange={(value) => !value && setPasswordFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set password — {passwordFor?.username}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              resetPassword.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                required
                minLength={8}
                maxLength={72}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={resetPassword.isPending}>
                Update Password
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/hooks/useAccount";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/account";
import { useSignedUrls } from "@/lib/images";
import { submitOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/_authenticated/my-order")({
  head: () => ({
    meta: [
      { title: "My Catalog Order — Jewel Brillance NYC" },
      {
        name: "description",
        content:
          "Review selected styles and quantities, then submit your wholesale catalog order to Jewel Brillance NYC.",
      },
      { property: "og:title", content: "My Catalog Order — Jewel Brillance NYC" },
      {
        property: "og:description",
        content: "Review your selected styles and submit your wholesale catalog order.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyOrderPage,
});

function MyOrderPage() {
  const queryClient = useQueryClient();
  const { account } = useAccount();
  const [form, setForm] = useState({
    customer_name: "",
    company_name: "",
    email: "",
    phone: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.customer) return;
    setForm((prev) => ({
      ...prev,
      customer_name: prev.customer_name || account.customer!.customer_name,
      company_name: prev.company_name || account.customer!.company_name,
      email: prev.email || account.customer!.email,
      phone: prev.phone || (account.customer!.phone ?? ""),
    }));
  }, [account]);

  const cart = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cart_items")
        .select(
          "id, quantity, product:products(id, style_number, product_name, wholesale_price, category:categories(name), product_images(image_path, image_order, is_primary))",
        )
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (cart.data ?? []).filter((row) => row.product);
  const paths = rows
    .map((row) => {
      const images = [...(row.product?.product_images ?? [])].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
      );
      return images[0]?.image_path;
    })
    .filter((path): path is string => Boolean(path));
  const signed = useSignedUrls(paths);

  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalValue = rows.reduce(
    (sum, row) => sum + row.quantity * Number(row.product?.wholesale_price ?? 0),
    0,
  );

  const updateQuantity = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cart_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      toast.success("Removed from your order");
    },
  });

  const submit = useMutation({
    mutationFn: async () => submitOrder({ data: form }),
    onSuccess: (result) => {
      setSubmitted(result.orderNumber);
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit your order"),
  });

  if (submitted) {
    return (
      <CustomerShell>
        <div className="mx-auto max-w-lg border border-border p-10 text-center">
          <h1 className="text-2xl text-primary">Order Submitted</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Thank you. Your catalog order <strong className="text-primary">{submitted}</strong> has
            been sent to Jewel Brillance NYC. Our team will contact you shortly.
          </p>
          <Button asChild className="mt-8">
            <Link to="/catalog" search={{ category: undefined, q: undefined }}>
              Continue Browsing
            </Link>
          </Button>
        </div>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <h1 className="mb-8 text-3xl text-primary">My Catalog Order</h1>

      {cart.isLoading ? (
        <div className="h-40 animate-pulse bg-secondary" />
      ) : rows.length === 0 ? (
        <div className="border border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">Your catalog order is empty.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/catalog" search={{ category: undefined, q: undefined }}>
              Browse the collection
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
          <div className="divide-y divide-border border-y border-border">
            {rows.map((row) => {
              const images = [...(row.product?.product_images ?? [])].sort(
                (a, b) =>
                  Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
              );
              const url = images[0] ? signed.data?.[images[0].image_path] : undefined;
              return (
                <div key={row.id} className="flex gap-4 py-5">
                  <div className="h-24 w-24 flex-shrink-0 overflow-hidden bg-secondary">
                    {url ? (
                      <img
                        src={url}
                        alt={row.product?.product_name ?? ""}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <p className="text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
                        {row.product?.style_number}
                      </p>
                      <p className="text-base text-primary">{row.product?.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPrice(row.product?.wholesale_price)} each
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        className="w-24"
                        aria-label="Quantity"
                        value={row.quantity}
                        onChange={(e) =>
                          updateQuantity.mutate({
                            id: row.id,
                            quantity: Math.max(1, Math.min(999, Number(e.target.value))),
                          })
                        }
                      />
                      <button
                        type="button"
                        className="text-xs tracking-[0.15em] text-muted-foreground uppercase hover:text-destructive"
                        onClick={() => removeItem.mutate(row.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-sm text-primary">
                    {formatPrice(row.quantity * Number(row.product?.wholesale_price ?? 0))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-fit border border-border p-6">
            <h2 className="text-lg text-primary">Order Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total styles</dt>
                <dd>{rows.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total quantity</dt>
                <dd>{totalQuantity}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Estimated total</dt>
                <dd className="text-primary">{formatPrice(totalValue)}</dd>
              </div>
            </dl>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                submit.mutate();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="customer_name">Customer name</Label>
                <Input
                  id="customer_name"
                  required
                  maxLength={120}
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Company name</Label>
                <Input
                  id="company_name"
                  required
                  maxLength={120}
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  maxLength={40}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  maxLength={2000}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submit.isPending}>
                {submit.isPending ? "Submitting…" : "Submit Catalog Order"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                No payment is taken. This sends your selection to Jewel Brillance NYC.
              </p>
            </form>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}

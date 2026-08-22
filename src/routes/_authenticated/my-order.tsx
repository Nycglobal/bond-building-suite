import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CustomerShell } from "@/components/CustomerShell";
import { ProductImage } from "@/components/ProductImage";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { account } = useAccount();
  const [form, setForm] = useState({
    customer_name: "",
    company_name: "",
    email: "",
    phone: "",
    notes: "",
  });

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
          "id, quantity, product:products(id, style_number, product_name, wholesale_price, category:categories(name), product_images(image_path, image_order, is_primary, bucket)), loose_diamond:loose_diamonds(id, carat_weight, shape, color_grade, clarity_grade, cut_style, image_path, page)",
        )
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (cart.data ?? []).filter((row) => row.product || row.loose_diamond);
  const paths = rows
    .map((row) => {
      if (row.product) {
        const images = [...(row.product.product_images ?? [])].sort(
          (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
        );
        return images[0];
      }
      if (!row.loose_diamond?.image_path) return undefined;
      const path =
        row.loose_diamond.image_path.startsWith("images/") &&
        Number(row.loose_diamond.carat_weight ?? 0) >= 4
          ? `images/4_carat_images/page_${String(row.loose_diamond.page ?? 0).padStart(3, "0")}.png`
          : row.loose_diamond.image_path;
      return { image_path: path, bucket: "images" };
    })
    .filter((image): image is NonNullable<typeof image> => Boolean(image));
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
    onSuccess: (submitResult) => {
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
      void queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      void navigate({
        to: "/order-success",
        search: {
          orderNumber: submitResult.orderNumber,
          emailed: submitResult.emailed,
        },
      });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not submit your order"),
  });

  return (
    <CustomerShell>
      <div className="mb-6 flex items-center justify-between gap-4 print:hidden">
        <h1 className="text-3xl text-primary">My Catalog Order</h1>
        {rows.length > 0 && (
          <Button type="button" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print Order
          </Button>
        )}
      </div>

      {cart.isLoading ? (
        <div className="h-40 animate-pulse bg-secondary" />
      ) : rows.length === 0 ? (
        <div className="border border-border py-20 text-center">
          <p className="text-sm text-muted-foreground">Your catalog order is empty.</p>
          <Button asChild variant="outline" className="mt-6">
            <Link
              to="/catalog"
              search={{
                category: undefined,
                q: undefined,
                ringFilter: undefined,
                trending: undefined,
                labGrown: undefined,
              }}
            >
              Browse the collection
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] print:hidden">
            <div className="divide-y divide-border border-y border-border">
              {rows.map((row) => {
                const images = [...(row.product?.product_images ?? [])].sort(
                  (a, b) =>
                    Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
                );
                const loosePath = row.loose_diamond?.image_path
                  ? row.loose_diamond.image_path.startsWith("images/") &&
                    Number(row.loose_diamond.carat_weight ?? 0) >= 4
                    ? `images/4_carat_images/page_${String(row.loose_diamond.page ?? 0).padStart(3, "0")}.png`
                    : row.loose_diamond.image_path
                  : undefined;
                const imagePath = images[0]?.image_path ?? loosePath;
                const url = imagePath ? signed.data?.[imagePath] : undefined;
                const name =
                  row.product?.product_name ??
                  `${row.loose_diamond?.carat_weight ?? ""} Carat ${row.loose_diamond?.shape ?? "Diamond"}`;
                const style =
                  row.product?.style_number ?? row.loose_diamond?.report_number ?? "Loose Diamond";
                return (
                  <div key={row.id} className="flex gap-4 py-5">
                    <div className="h-24 w-24 shrink-0 overflow-hidden bg-secondary">
                      <ProductImage src={url} alt={name} urlLoading={signed.isLoading} />
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <p className="text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase">
                          {style}
                        </p>
                        <p className="text-base text-primary">{name}</p>
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
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="border border-border/60 uppercase tracking-[0.15em] hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeItem.mutate(row.id)}
                        >
                          Remove
                        </Button>
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

          {/* Printable catalog order document (only visible when printing). */}
          <div className="hidden print:block">
            <div className="flex items-end justify-between border-b-2 border-primary pb-4">
              <div>
                <h1 className="text-2xl uppercase tracking-[0.12em] text-primary">
                  Jewel Brillance NYC
                </h1>
                <p className="mt-1 text-xs tracking-[0.3em] text-muted-foreground uppercase">
                  Wholesale Catalog Order
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
              <div className="space-y-1">
                <p>
                  <span className="text-muted-foreground">Customer: </span>
                  <span className="font-medium text-primary">{form.customer_name}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Company: </span>
                  <span className="font-medium text-primary">{form.company_name}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Email: </span>
                  <span className="font-medium text-primary">{form.email}</span>
                </p>
                {form.phone && (
                  <p>
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="font-medium text-primary">{form.phone}</span>
                  </p>
                )}
              </div>
            </div>

            <table className="mt-6 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-primary text-left">
                  <th className="w-20 py-2 pr-4 font-medium">Image</th>
                  <th className="py-2 pr-4 font-medium">Style #</th>
                  <th className="py-2 pr-4 font-medium">Product</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Wholesale</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const images = [...(row.product?.product_images ?? [])].sort(
                    (a, b) =>
                      Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
                  );
                  const loosePath = row.loose_diamond?.image_path
                    ? row.loose_diamond.image_path.startsWith("images/") &&
                      Number(row.loose_diamond.carat_weight ?? 0) >= 4
                      ? `images/4_carat_images/page_${String(row.loose_diamond.page ?? 0).padStart(3, "0")}.png`
                      : row.loose_diamond.image_path
                    : undefined;
                  const imagePath = images[0]?.image_path ?? loosePath;
                  const imageUrl = imagePath ? signed.data?.[imagePath] : undefined;
                  const productName =
                    row.product?.product_name ??
                    `${row.loose_diamond?.carat_weight ?? ""} Carat ${row.loose_diamond?.shape ?? "Diamond"}`;

                  return (
                    <tr key={row.id} className="border-b border-border">
                      <td className="py-2 pr-4">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={productName}
                            loading="eager"
                            className="h-14 w-14 object-cover"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">No image</span>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {row.product?.style_number ?? row.loose_diamond?.report_number ?? "-"}
                      </td>
                      <td className="py-2 pr-4">{productName}</td>
                      <td className="py-2 pr-4 text-right">{row.quantity}</td>
                      <td className="py-2 pr-4 text-right">
                        {formatPrice(row.product?.wholesale_price)}
                      </td>
                      <td className="py-2 text-right">
                        {formatPrice(row.quantity * Number(row.product?.wholesale_price ?? 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 flex items-end justify-between text-sm">
              <div className="space-y-1 text-muted-foreground">
                <p>
                  Total styles: <span className="font-medium text-primary">{rows.length}</span>
                </p>
                <p>
                  Total quantity: <span className="font-medium text-primary">{totalQuantity}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                  Estimated total
                </p>
                <p className="text-xl text-primary">{formatPrice(totalValue)}</p>
              </div>
            </div>

            {form.notes && (
              <div className="mt-6 border-t border-border pt-4 text-sm">
                <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-primary">{form.notes}</p>
              </div>
            )}
          </div>
        </>
      )}
    </CustomerShell>
  );
}

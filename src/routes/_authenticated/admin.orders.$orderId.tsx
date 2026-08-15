import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminShell } from "@/components/AdminShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, ORDER_STATUSES } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/admin/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Order Detail — Jewel Brillance NYC Admin" },
      {
        name: "description",
        content: "Full line items, customer details and status for a wholesale catalog order.",
      },
      { property: "og:title", content: "Order Detail — Jewel Brillance NYC Admin" },
      { property: "og:description", content: "Line items and status for a catalog order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminOrderDetail,
  errorComponent: () => (
    <AdminShell title="Order">
      <p className="text-sm text-muted-foreground">This order could not be loaded.</p>
    </AdminShell>
  ),
  notFoundComponent: () => (
    <AdminShell title="Order">
      <p className="text-sm text-muted-foreground">Order not found.</p>
    </AdminShell>
  ),
});

function AdminOrderDetail() {
  const { orderId } = Route.useParams();
  const queryClient = useQueryClient();

  const order = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.from("orders").update({ status: value }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Status updated");
    },
  });

  if (order.isLoading) {
    return (
      <AdminShell title="Order">
        <div className="h-48 animate-pulse bg-secondary" />
      </AdminShell>
    );
  }

  if (!order.data) {
    return (
      <AdminShell title="Order">
        <p className="text-sm text-muted-foreground">Order not found.</p>
      </AdminShell>
    );
  }

  const data = order.data;

  return (
    <AdminShell title={`Order ${data.order_number}`}>
      <Link
        to="/admin/orders"
        className="mb-6 inline-block text-xs tracking-[0.2em] text-muted-foreground uppercase hover:text-primary"
      >
        ← All orders
      </Link>

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
              <tr>
                <th className="p-4">Style #</th>
                <th className="p-4">Product</th>
                <th className="p-4">Category</th>
                <th className="p-4 text-center">Qty</th>
                <th className="p-4 text-right">Wholesale</th>
                <th className="p-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(data.order_items ?? []).map((item: Record<string, string | number>) => (
                <tr key={String(item["id"])} className="border-b border-border last:border-0">
                  <td className="p-4">{item["style_number"]}</td>
                  <td className="p-4">{item["product_name"]}</td>
                  <td className="p-4">{item["category_name"] ?? "—"}</td>
                  <td className="p-4 text-center">{item["quantity"]}</td>
                  <td className="p-4 text-right">{formatPrice(item["unit_price"])}</td>
                  <td className="p-4 text-right">{formatPrice(item["total_price"])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="border border-border bg-background p-6">
            <h2 className="mb-4 text-lg text-primary">Customer</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Company</dt>
                <dd>{data.company_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Contact</dt>
                <dd>{data.customer_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Email</dt>
                <dd>{data.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Phone</dt>
                <dd>{data.phone ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground uppercase">Submitted</dt>
                <dd>{new Date(data.created_at).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-border bg-background p-6">
            <h2 className="mb-4 text-lg text-primary">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total styles</dt>
                <dd>{data.total_styles}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Total quantity</dt>
                <dd>{data.total_quantity}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Estimated total</dt>
                <dd className="text-primary">{formatPrice(data.total_value)}</dd>
              </div>
            </dl>
            <div className="mt-5">
              <p className="mb-2 text-xs tracking-[0.15em] text-muted-foreground uppercase">
                Status
              </p>
              <Select value={data.status} onValueChange={(value) => updateStatus.mutate(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {data.notes && (
            <div className="border border-border bg-background p-6">
              <h2 className="mb-2 text-lg text-primary">Notes</h2>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{data.notes}</p>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

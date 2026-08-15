import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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

export const Route = createFileRoute("/_authenticated/admin/orders/")({
  head: () => ({
    meta: [
      { title: "Orders — Jewel Brillance NYC Admin" },
      {
        name: "description",
        content: "Review incoming wholesale catalog orders and update their status.",
      },
      { property: "og:title", content: "Orders — Jewel Brillance NYC Admin" },
      { property: "og:description", content: "Review wholesale catalog orders and statuses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminOrders,
});

function AdminOrders() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("all");

  const orders = useQuery({
    queryKey: ["admin-orders", status],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          "id, order_number, company_name, customer_name, status, total_styles, total_quantity, total_value, created_at",
        )
        .order("created_at", { ascending: false });
      if (status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from("orders").update({ status: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Status updated");
    },
  });

  return (
    <AdminShell title="Orders">
      <div className="mb-6 w-56">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {ORDER_STATUSES.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
            <tr>
              <th className="p-4">Order</th>
              <th className="p-4">Date</th>
              <th className="p-4">Company</th>
              <th className="p-4">Styles</th>
              <th className="p-4">Qty</th>
              <th className="p-4 text-right">Total</th>
              <th className="p-4 w-44">Status</th>
            </tr>
          </thead>
          <tbody>
            {(orders.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  No orders found.
                </td>
              </tr>
            ) : (
              (orders.data ?? []).map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0">
                  <td className="p-4">
                    <Link
                      to="/admin/orders/$orderId"
                      params={{ orderId: order.id }}
                      className="text-primary underline underline-offset-4"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="p-4">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="p-4">
                    <div>{order.company_name}</div>
                    <div className="text-xs text-muted-foreground">{order.customer_name}</div>
                  </td>
                  <td className="p-4">{order.total_styles}</td>
                  <td className="p-4">{order.total_quantity}</td>
                  <td className="p-4 text-right">{formatPrice(order.total_value)}</td>
                  <td className="p-4">
                    <Select
                      value={order.status}
                      onValueChange={(value) => updateStatus.mutate({ id: order.id, value })}
                    >
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

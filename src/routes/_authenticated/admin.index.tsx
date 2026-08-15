import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/account";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Jewel Brillance NYC" },
      {
        name: "description",
        content: "Overview of catalog styles, wholesale customers and incoming catalog orders.",
      },
      { property: "og:title", content: "Admin Dashboard — Jewel Brillance NYC" },
      {
        property: "og:description",
        content: "Overview of catalog styles, customers and catalog orders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [products, customers, orders, newOrders, recent] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "New"),
        supabase
          .from("orders")
          .select("id, order_number, company_name, status, total_value, created_at")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      return {
        products: products.count ?? 0,
        customers: customers.count ?? 0,
        orders: orders.count ?? 0,
        newOrders: newOrders.count ?? 0,
        recent: recent.data ?? [],
      };
    },
  });

  const cards = [
    { label: "Products", value: stats.data?.products ?? 0 },
    { label: "Customers", value: stats.data?.customers ?? 0 },
    { label: "Orders", value: stats.data?.orders ?? 0 },
    { label: "New Orders", value: stats.data?.newOrders ?? 0 },
  ];

  return (
    <AdminShell title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="border border-border bg-background p-6">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">{card.label}</p>
            <p className="mt-3 text-3xl text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-12 mb-4 text-xl text-primary">Recent Orders</h2>
      <div className="border border-border bg-background">
        {(stats.data?.recent ?? []).length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
              <tr>
                <th className="p-4">Order</th>
                <th className="p-4">Company</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(stats.data?.recent ?? []).map((order) => (
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
                  <td className="p-4">{order.company_name}</td>
                  <td className="p-4">{order.status}</td>
                  <td className="p-4 text-right">{formatPrice(order.total_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

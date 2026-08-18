import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgePlus, Package, ShoppingBag, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { AdminShell } from "@/components/AdminShell";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice, ORDER_STATUSES } from "@/lib/account";

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

/** Days shown on the order-trend chart. */
const TREND_DAYS = 14;

const trendChartConfig = {
  orders: { label: "Orders", color: "hsl(var(--chart-1))" },
};

const statusChartConfig = {
  New: { label: "New", color: "hsl(var(--chart-1))" },
  Reviewing: { label: "Reviewing", color: "hsl(var(--chart-2))" },
  Confirmed: { label: "Confirmed", color: "hsl(var(--chart-3))" },
  Completed: { label: "Completed", color: "hsl(var(--chart-4))" },
  Cancelled: { label: "Cancelled", color: "hsl(var(--chart-5))" },
  Unknown: { label: "Unknown", color: "hsl(var(--muted-foreground))" },
};

const categoryChartConfig = {
  count: { label: "Products", color: "hsl(var(--chart-1))" },
};

function AdminDashboard() {
  const stats = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - (TREND_DAYS - 1));
      since.setHours(0, 0, 0, 0);

      const [products, customers, orders, newOrders, recent, categoryRows, orderRows] =
        await Promise.all([
          supabase.from("products").select("id", { count: "exact", head: true }),
          supabase.from("customers").select("id", { count: "exact", head: true }),
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "New"),
          supabase
            .from("orders")
            .select("id, order_number, company_name, status, total_value, created_at")
            .order("created_at", { ascending: false })
            .limit(6),
          supabase.from("products").select("category:categories(name)"),
          supabase.from("orders").select("status, created_at, total_value"),
        ]);

      // Products grouped by category.
      const categoryMap = new Map<string, number>();
      for (const row of categoryRows.data ?? []) {
        const name = row.category?.name ?? "Uncategorized";
        categoryMap.set(name, (categoryMap.get(name) ?? 0) + 1);
      }
      const productsByCategory = [...categoryMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Orders grouped by status + total revenue.
      const statusMap = new Map<string, number>();
      let revenue = 0;
      for (const order of orderRows.data ?? []) {
        const status = order.status ?? "Unknown";
        statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
        revenue += Number(order.total_value ?? 0);
      }
      const ordersByStatus: { status: string; count: number }[] = ORDER_STATUSES.filter((status) =>
        statusMap.has(status),
      ).map((status) => ({ status, count: statusMap.get(status) ?? 0 }));
      for (const [status, count] of statusMap) {
        if (!ordersByStatus.some((row) => row.status === status)) {
          ordersByStatus.push({ status, count });
        }
      }

      // Daily order volume for the last TREND_DAYS days.
      const days: string[] = [];
      for (let i = TREND_DAYS - 1; i >= 0; i--) {
        const day = new Date(since.getTime() + i * 86_400_000);
        days.push(day.toISOString().slice(0, 10));
      }
      const countsByDay = new Map<string, number>(days.map((day) => [day, 0] as const));
      for (const order of orderRows.data ?? []) {
        const day = new Date(order.created_at ?? Date.now()).toISOString().slice(0, 10);
        if (countsByDay.has(day)) countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
      }
      const orderTrend = days.map((day) => ({
        date: new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        orders: countsByDay.get(day) ?? 0,
      }));

      return {
        products: products.count ?? 0,
        customers: customers.count ?? 0,
        orders: orders.count ?? 0,
        newOrders: newOrders.count ?? 0,
        revenue,
        recent: recent.data ?? [],
        productsByCategory,
        ordersByStatus,
        orderTrend,
      };
    },
  });

  const loaded = stats.data !== undefined;
  const hasOrders = (stats.data?.orders ?? 0) > 0;

  const cards = [
    { label: "Products", value: stats.data?.products ?? 0, icon: Package },
    { label: "Customers", value: stats.data?.customers ?? 0, icon: Users },
    { label: "Orders", value: stats.data?.orders ?? 0, icon: ShoppingBag },
    { label: "New Orders", value: stats.data?.newOrders ?? 0, icon: BadgePlus },
  ];

  const pieData = (stats.data?.ordersByStatus ?? []).map((row) => ({
    ...row,
    fill: `var(--color-${row.status})`,
  }));

  return (
    <AdminShell title="Dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="border border-border bg-background p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                {card.label}
              </p>
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-secondary text-primary">
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 text-3xl text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <div className="border border-border bg-background p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg text-primary">Order Trends</h2>
              <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
                Last {TREND_DAYS} days
              </p>
            </div>
            <p className="text-right">
              <span className="block text-xs tracking-[0.15em] text-muted-foreground uppercase">
                Revenue
              </span>
              <span className="text-xl text-primary">{formatPrice(stats.data?.revenue ?? 0)}</span>
            </p>
          </div>
          {!loaded ? (
            <div className="h-[260px] animate-pulse bg-secondary" />
          ) : hasOrders ? (
            <ChartContainer config={trendChartConfig} className="h-[260px] w-full">
              <AreaChart data={stats.data?.orderTrend ?? []} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="natural"
                  dataKey="orders"
                  stroke="var(--color-orders)"
                  fill="var(--color-orders)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="grid h-[260px] place-items-center text-sm text-muted-foreground">
              No order data yet.
            </div>
          )}
        </div>

        <div className="border border-border bg-background p-6">
          <h2 className="mb-4 text-lg text-primary">Orders by Status</h2>
          {!loaded ? (
            <div className="h-[260px] animate-pulse bg-secondary" />
          ) : hasOrders ? (
            <ChartContainer config={statusChartConfig} className="h-[260px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={pieData}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  strokeWidth={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="status" />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="grid h-[260px] place-items-center text-sm text-muted-foreground">
              No order data yet.
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="border border-border bg-background p-6">
          <h2 className="mb-4 text-lg text-primary">Products by Category</h2>
          {!loaded ? (
            <div className="h-[280px] animate-pulse bg-secondary" />
          ) : (
            <ChartContainer config={categoryChartConfig} className="h-[280px] w-full">
              <BarChart data={stats.data?.productsByCategory ?? []} margin={{ left: 0, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </div>

        <div className="border border-border bg-background">
          <div className="flex items-center justify-between px-6 pt-6">
            <h2 className="text-lg text-primary">Recent Orders</h2>
            <Link
              to="/admin/orders"
              className="text-xs tracking-[0.15em] text-muted-foreground uppercase hover:text-primary"
            >
              View all
            </Link>
          </div>
          {(stats.data?.recent ?? []).length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead className="border-y border-border text-left text-xs tracking-[0.15em] text-muted-foreground uppercase">
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
      </div>
    </AdminShell>
  );
}

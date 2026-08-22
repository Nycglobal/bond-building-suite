import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Eye, History, PackageCheck } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { CustomerShell } from "@/components/CustomerShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductImage } from "@/components/ProductImage";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { formatPrice } from "@/lib/account";
import { looseDiamondImagePath } from "@/lib/loose-diamonds";
import { useSignedUrls } from "@/lib/images";

const PERIODS = ["week", "month", "all"] as const;
type Period = (typeof PERIODS)[number];

type OrderHistoryItem = {
  id: string;
  style_number: string;
  product_name: string;
  category_name: string | null;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  product: {
    product_images: {
      image_path: string;
      image_order: number;
      is_primary: boolean;
      bucket: string | null;
    }[];
  } | null;
  loose_diamond: {
    image_path: string | null;
    carat_weight: number | null;
    page: number | null;
  } | null;
};

type OrderHistoryRow = {
  id: string;
  order_number: string;
  created_at: string;
  status: string;
  total_styles: number;
  total_quantity: number;
  total_value: number | string;
  order_items: OrderHistoryItem[];
};

export const Route = createFileRoute("/_authenticated/order-history")({
  head: () => ({
    meta: [
      { title: "Order History — Jewel Brillance NYC" },
      {
        name: "description",
        content: "Review your wholesale catalog order history and ordered products.",
      },
    ],
  }),
  component: OrderHistoryPage,
});

function getStartDate(period: Period) {
  if (period === "all") return undefined;
  const date = new Date();
  if (period === "week") {
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  } else {
    date.setDate(1);
  }
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function periodLabel(period: Period) {
  if (period === "week") return "This week";
  if (period === "month") return "This month";
  return "All time";
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateRange(range: DateRange | undefined) {
  if (!range?.from) return "Select date range";
  const from = range.from.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (!range.to) return `${from} - ...`;
  const to = range.to.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${from} - ${to}`;
}

function OrderHistoryPage() {
  const [period, setPeriod] = useState<Period>("week");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>();
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<OrderHistoryItem | null>(null);
  const orders = useQuery({
    queryKey: ["order-history", period, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          "id, order_number, created_at, status, total_styles, total_quantity, total_value, order_items(id, style_number, product_name, category_name, quantity, unit_price, total_price, product:products(product_images(image_path, image_order, is_primary, bucket)), loose_diamond:loose_diamonds(image_path, carat_weight, page))",
        )
        .order("created_at", { ascending: false });
      const filterStart = startDate
        ? new Date(`${startDate}T00:00:00`).toISOString()
        : getStartDate(period);
      if (filterStart) query = query.gte("created_at", filterStart);
      if (endDate) {
        query = query.lt(
          "created_at",
          new Date(new Date(`${endDate}T00:00:00`).getTime() + 86400000).toISOString(),
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as OrderHistoryRow[];
    },
  });

  const history = orders.data ?? [];
  const imageRefs = history.flatMap((order) =>
    order.order_items.flatMap((item) => {
      const images = [...(item.product?.product_images ?? [])].sort(
        (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.image_order - b.image_order,
      );
      if (images[0]) {
        return [{ itemId: item.id, image_path: images[0].image_path, bucket: images[0].bucket }];
      }
      const path = item.loose_diamond ? looseDiamondImagePath(item.loose_diamond) : undefined;
      return path ? [{ itemId: item.id, image_path: path, bucket: "images" }] : [];
    }),
  );
  const signed = useSignedUrls(imageRefs);
  const imageByItemId = new Map(
    imageRefs.map((ref) => [ref.itemId, signed.data?.[ref.image_path]] as const),
  );
  const orderCount = history.length;
  const productCount = history.reduce((sum, order) => sum + order.total_quantity, 0);
  const totalValue = history.reduce((sum, order) => sum + Number(order.total_value), 0);
  const previewImage = previewItem ? imageByItemId.get(previewItem.id) : undefined;

  return (
    <CustomerShell>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase">Your account</p>
          <h1 className="mt-2 text-3xl text-primary">Order History</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review the products you have ordered from Jewel Brillance NYC.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div
            className="order-2 flex rounded-md border border-border bg-background p-1 sm:order-2"
            role="tablist"
          >
            {PERIODS.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={period === item ? "default" : "ghost"}
                role="tab"
                aria-selected={period === item}
                onClick={() => {
                  setPeriod(item);
                  setStartDate("");
                  setEndDate("");
                  setDateRange(undefined);
                  setDatePickerOpen(false);
                }}
              >
                {periodLabel(item)}
              </Button>
            ))}
          </div>
          <div className="order-1 flex flex-wrap items-end justify-end gap-2 sm:order-1">
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="min-w-52 justify-start">
                  <CalendarDays />
                  {formatDateRange(dateRange)}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-auto p-0">
                <Calendar
                  mode="range"
                  min={1}
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);
                    setPeriod("all");
                    setStartDate(range?.from ? formatDateInput(range.from) : "");
                    setEndDate(range?.to ? formatDateInput(range.to) : "");
                    setDatePickerOpen(Boolean(range?.from && !range?.to));
                  }}
                  numberOfMonths={1}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            {(startDate || endDate) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setDateRange(undefined);
                  setPeriod("all");
                  setDatePickerOpen(false);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={CalendarDays}
          label={periodLabel(period)}
          value={`${orderCount} orders`}
        />
        <SummaryCard icon={PackageCheck} label="Products ordered" value={String(productCount)} />
        <SummaryCard icon={History} label="Order value" value={formatPrice(totalValue)} />
      </div>

      {orders.isLoading ? (
        <div className="h-48 animate-pulse bg-secondary" />
      ) : orders.isError ? (
        <div className="border border-destructive/30 p-8 text-center text-sm text-destructive">
          Could not load your order history. Please refresh and try again.
        </div>
      ) : history.length === 0 ? (
        <div className="border border-border py-20 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">
            No orders found for {periodLabel(period).toLowerCase()}.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {history.map((order) => (
            <article key={order.id} className="border border-border bg-background">
              <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">Order</p>
                  <h2 className="mt-1 text-lg text-primary">{order.order_number}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-5 sm:text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium text-primary">{order.status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-sm font-medium text-primary">
                      {formatPrice(order.total_value)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-152 text-sm">
                  <thead className="border-b border-border text-left text-xs tracking-[0.12em] text-muted-foreground uppercase">
                    <tr>
                      <th className="px-5 py-3">Image</th>
                      <th className="px-5 py-3">Style #</th>
                      <th className="px-5 py-3">Product</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3 text-right">Qty</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3 text-right">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.order_items.map((item) => (
                      <tr key={item.id} className="border-b border-border last:border-0">
                        <td className="px-5 py-3">
                          {imageByItemId.get(item.id) ? (
                            <img
                              src={imageByItemId.get(item.id)}
                              alt={item.product_name}
                              loading="lazy"
                              className="h-14 w-14 rounded-sm object-cover"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">No image</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{item.style_number}</td>
                        <td className="px-5 py-3 text-primary">{item.product_name}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {item.category_name ?? "-"}
                        </td>
                        <td className="px-5 py-3 text-right">{item.quantity}</td>
                        <td className="px-5 py-3 text-right text-primary">
                          {formatPrice(item.total_price)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Preview ${item.product_name}`}
                            title="Preview product"
                            onClick={() => setPreviewItem(item)}
                          >
                            <Eye />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          {previewItem && (
            <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
              <div className="aspect-square bg-secondary sm:aspect-auto sm:min-h-112">
                <ProductImage
                  src={previewImage}
                  alt={previewItem.product_name}
                  urlLoading={signed.isLoading}
                  loading="eager"
                />
              </div>
              <div className="flex flex-col justify-center p-6 sm:p-8">
                <DialogHeader className="text-left">
                  <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
                    {previewItem.category_name ?? "Product"}
                  </p>
                  <DialogTitle className="mt-2 text-2xl text-primary">
                    {previewItem.product_name}
                  </DialogTitle>
                  <DialogDescription className="mt-2">
                    Style {previewItem.style_number}
                  </DialogDescription>
                </DialogHeader>
                <dl className="mt-8 space-y-3 border-t border-border pt-5 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Quantity</dt>
                    <dd className="text-primary">{previewItem.quantity}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Unit price</dt>
                    <dd className="text-primary">{formatPrice(previewItem.unit_price)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-3">
                    <dt className="text-muted-foreground">Order total</dt>
                    <dd className="font-medium text-primary">
                      {formatPrice(previewItem.total_price)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </CustomerShell>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="border border-border bg-background p-5">
      <Icon className="h-5 w-5 text-accent" />
      <p className="mt-4 text-xs tracking-[0.15em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-xl text-primary">{value}</p>
    </div>
  );
}

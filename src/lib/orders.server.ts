import type { SupabaseClient } from "@supabase/supabase-js";

type CartRow = {
  quantity: number;
  product: {
    id: string;
    style_number: string;
    product_name: string;
    wholesale_price: number | string;
    category: { name: string } | null;
  } | null;
  loose_diamond: {
    id: string;
    carat_weight: number | null;
    shape: string | null;
    color_grade: string | null;
    clarity_grade: string | null;
    cut_style: string | null;
    report_number: string | null;
  } | null;
};

export type OrderItemRow = {
  product_id: string | null;
  loose_diamond_id: string | null;
  style_number: string;
  product_name: string;
  category_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
};

export function buildOrderRows(cart: unknown[]) {
  const items: OrderItemRow[] = [];
  let totalQuantity = 0;
  let totalValue = 0;

  for (const raw of cart as CartRow[]) {
    const product = raw.product;
    const diamond = raw.loose_diamond;
    if (!product && !diamond) continue;
    const quantity = Math.max(1, Math.trunc(raw.quantity ?? 1));
    const unitPrice = Number(product?.wholesale_price ?? 0);
    const totalPrice = Number((unitPrice * quantity).toFixed(2));
    totalQuantity += quantity;
    totalValue += totalPrice;
    items.push({
      product_id: product?.id ?? null,
      loose_diamond_id: diamond?.id ?? null,
      style_number: product?.style_number ?? diamond?.report_number ?? "Loose Diamond",
      product_name:
        product?.product_name ??
        `${diamond?.carat_weight ?? ""} Carat ${diamond?.shape ?? "Diamond"}`,
      category_name: product?.category?.name ?? "Loose Diamond",
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
    });
  }

  return {
    items,
    totalStyles: items.length,
    totalQuantity,
    totalValue: Number(totalValue.toFixed(2)),
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function buildOrderEmailHtml(order: {
  order_number: string;
  customer_name: string;
  company_name: string;
  email: string;
  phone: string | null;
  notes: string | null;
  total_styles: number;
  total_quantity: number;
  total_value: number | string;
  items: OrderItemRow[];
  company: string;
}) {
  const rows = order.items
    .map(
      (item) => `<tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;">${item.style_number}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;">${item.product_name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;">${item.category_name ?? "—"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;text-align:right;">${money(item.unit_price)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e6e8ee;text-align:right;">${money(item.total_price)}</td>
      </tr>`,
    )
    .join("");

  return `<div style="font-family:Helvetica,Arial,sans-serif;color:#12213c;max-width:720px;margin:0 auto;">
    <h1 style="font-size:20px;letter-spacing:.12em;text-transform:uppercase;border-bottom:2px solid #12213c;padding-bottom:12px;">
      ${order.company} — Wholesale Catalog Order
    </h1>
    <p style="font-size:15px;"><strong>Order Number:</strong> ${order.order_number}</p>
    <p style="font-size:15px;line-height:1.7;">
      <strong>Customer:</strong> ${order.customer_name}<br/>
      <strong>Company:</strong> ${order.company_name}<br/>
      <strong>Email:</strong> ${order.email}<br/>
      <strong>Phone:</strong> ${order.phone ?? "—"}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
      <thead>
        <tr style="background:#f4f5f8;text-align:left;">
          <th style="padding:10px 12px;">Style #</th>
          <th style="padding:10px 12px;">Product</th>
          <th style="padding:10px 12px;">Category</th>
          <th style="padding:10px 12px;text-align:center;">Qty</th>
          <th style="padding:10px 12px;text-align:right;">Wholesale</th>
          <th style="padding:10px 12px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:15px;margin-top:16px;">
      <strong>Total Styles:</strong> ${order.total_styles} &nbsp;·&nbsp;
      <strong>Total Quantity:</strong> ${order.total_quantity} &nbsp;·&nbsp;
      <strong>Estimated Total:</strong> ${money(Number(order.total_value))}
    </p>
    ${order.notes ? `<p style="font-size:15px;"><strong>Notes:</strong><br/>${order.notes}</p>` : ""}
  </div>`;
}

/**
 * Sends the order notification + customer confirmation when an email provider
 * is configured. Uses Resend's HTTP API when RESEND_API_KEY is set. The order
 * itself is always saved and visible in the admin panel, even if email is not
 * configured or delivery fails; the caller can surface the returned boolean to
 * let the customer know whether a confirmation email went out.
 */
export async function sendOrderEmails(admin: SupabaseClient, orderId: string) {
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).maybeSingle();
  const { data: items } = await admin.from("order_items").select("*").eq("order_id", orderId);
  const { data: settings } = await admin.from("settings").select("*").eq("id", 1).maybeSingle();
  if (!order || !settings) return false;

  const html = buildOrderEmailHtml({
    ...order,
    items: (items ?? []) as OrderItemRow[],
    company: settings.company_name,
  });

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.info(
      `Order ${order.order_number} saved. Email sending is not configured yet (set RESEND_API_KEY).`,
    );
    return false;
  }

  const to = [settings.wholesale_email, order.email].filter((address): address is string =>
    Boolean(address),
  );
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:
        process.env["LOVABLE_EMAIL_FROM"] ?? "Jewel Brillance NYC <orders@jewelbrillancenyc.com>",
      to,
      subject: `Wholesale Catalog Order ${order.order_number} — ${order.company_name}`,
      html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Order ${order.order_number} email failed: ${response.status} ${text}`);
    return false;
  }

  console.info(`Order ${order.order_number} email sent to ${to.join(", ")}`);
  return true;
}

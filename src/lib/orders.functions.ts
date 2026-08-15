import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const submitSchema = z.object({
  customer_name: z.string().trim().min(1, "Customer name is required").max(120),
  company_name: z.string().trim().min(1, "Company name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const submitOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { getAdminClient } = await import("@/lib/admin.server");
    const { buildOrderRows, sendOrderEmails } = await import("@/lib/orders.server");
    const admin = await getAdminClient();

    const { data: customer } = await admin
      .from("customers")
      .select("id, active")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (customer && !customer.active) throw new Error("This account is inactive");

    const { data: cart, error: cartError } = await admin
      .from("cart_items")
      .select("quantity, product:products(id, style_number, product_name, wholesale_price, category:categories(name))")
      .eq("user_id", context.userId);
    if (cartError) throw new Error(cartError.message);
    if (!cart || cart.length === 0) throw new Error("Your catalog order is empty");

    const { items, totalStyles, totalQuantity, totalValue } = buildOrderRows(cart);

    const { data: numberData, error: numberError } = await admin.rpc("next_order_number");
    if (numberError) throw new Error(numberError.message);
    const orderNumber = numberData as unknown as string;

    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: customer?.id ?? null,
        user_id: context.userId,
        customer_name: data.customer_name,
        company_name: data.company_name,
        email: data.email,
        phone: data.phone || null,
        notes: data.notes || null,
        status: "New",
        total_styles: totalStyles,
        total_quantity: totalQuantity,
        total_value: totalValue,
      })
      .select("id, order_number")
      .single();
    if (orderError || !order) throw new Error(orderError?.message ?? "Could not save the order");

    const { error: itemsError } = await admin
      .from("order_items")
      .insert(items.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) {
      await admin.from("orders").delete().eq("id", order.id);
      throw new Error(itemsError.message);
    }

    await admin.from("cart_items").delete().eq("user_id", context.userId);

    const emailed = await sendOrderEmails(admin, order.id);

    return { orderNumber: order.order_number, emailed };
  });

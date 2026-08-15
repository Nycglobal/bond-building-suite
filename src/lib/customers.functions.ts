import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { usernameToEmail } from "@/lib/account";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(40)
  .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dot, dash or underscore only");

const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

const customerSchema = z.object({
  company_name: z.string().trim().min(1, "Company name is required").max(120),
  customer_name: z.string().trim().min(1, "Customer name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  username: usernameSchema,
  password: passwordSchema,
  active: z.boolean().default(true),
});

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => customerSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, getAdminClient } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const admin = await getAdminClient();

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: usernameToEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username, company_name: data.company_name },
    });
    if (authError || !created.user) {
      throw new Error(authError?.message ?? "Could not create the login");
    }

    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "customer" });
    if (roleError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleError.message);
    }

    const { error: rowError } = await admin.from("customers").insert({
      user_id: created.user.id,
      company_name: data.company_name,
      customer_name: data.customer_name,
      email: data.email,
      phone: data.phone || null,
      username: data.username.toLowerCase(),
      active: data.active,
    });
    if (rowError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(rowError.message);
    }

    return { ok: true };
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    customerSchema.omit({ password: true }).extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, getAdminClient } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const admin = await getAdminClient();

    const { data: existing, error: readError } = await admin
      .from("customers")
      .select("id, user_id, username")
      .eq("id", data.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) throw new Error("Customer not found");

    const { error } = await admin
      .from("customers")
      .update({
        company_name: data.company_name,
        customer_name: data.customer_name,
        email: data.email,
        phone: data.phone || null,
        username: data.username.toLowerCase(),
        active: data.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (existing.user_id && existing.username !== data.username.toLowerCase()) {
      await admin.auth.admin.updateUserById(existing.user_id, {
        email: usernameToEmail(data.username),
        email_confirm: true,
      });
    }

    return { ok: true };
  });

export const setCustomerPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), password: passwordSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, getAdminClient } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const admin = await getAdminClient();

    const { data: existing } = await admin
      .from("customers")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!existing?.user_id) throw new Error("Customer login not found");

    const { error } = await admin.auth.admin.updateUserById(existing.user_id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, getAdminClient } = await import("@/lib/admin.server");
    await assertAdmin(context.supabase, context.userId);
    const admin = await getAdminClient();

    const { data: existing } = await admin
      .from("customers")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await admin.from("customers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (existing?.user_id) await admin.auth.admin.deleteUser(existing.user_id);
    return { ok: true };
  });

/** Public: reports whether the very first admin still needs to be created. */
export const adminExists = createServerFn({ method: "GET" }).handler(async () => {
  const { getAdminClient } = await import("@/lib/admin.server");
  const admin = await getAdminClient();
  const { count, error } = await admin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) throw new Error(error.message);
  return { exists: (count ?? 0) > 0 };
});

/** Public one-time setup: creates the first admin login only when none exists. */
export const createFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ username: usernameSchema, password: passwordSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("@/lib/admin.server");
    const admin = await getAdminClient();

    const { count } = await admin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) throw new Error("An administrator already exists");

    const { data: created, error } = await admin.auth.admin.createUser({
      email: usernameToEmail(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: { username: data.username },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create admin");

    const { error: roleError } = await admin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "admin" });
    if (roleError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(roleError.message);
    }
    return { ok: true };
  });

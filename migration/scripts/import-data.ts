/**
 * Imports exported table data into the target project, remapping user ids via
 * migration/data/user-map.json, then advances the order-number sequence.
 *
 * Run AFTER combined.sql has been applied and create-users.ts has run:
 *   TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... bun migration/scripts/import-data.ts
 */
import { createClient } from "@supabase/supabase-js";

const DST_URL = process.env["TARGET_SUPABASE_URL"]!;
const DST_KEY = process.env["TARGET_SERVICE_ROLE_KEY"]!;
if (!DST_URL || !DST_KEY) throw new Error("Missing TARGET_SUPABASE_URL / TARGET_SERVICE_ROLE_KEY");

const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } });

const userMap: Record<string, string> = await Bun.file("migration/data/user-map.json").json();

// Dependency order matters: parents before children.
const TABLES = [
  "categories",
  "products",
  "product_images",
  "customers",
  "user_roles",
  "settings",
  "orders",
  "order_items",
  "cart_items",
] as const;

// Rows in these tables point at auth users and must be remapped.
const USER_COLUMNS: Record<string, string> = {
  customers: "user_id",
  user_roles: "user_id",
  orders: "user_id",
  cart_items: "user_id",
};

type Row = Record<string, unknown>;

function remap(table: string, rows: Row[]): Row[] {
  const column = USER_COLUMNS[table];
  if (!column) return rows;
  const kept: Row[] = [];
  for (const row of rows) {
    const oldId = row[column] as string | null;
    if (oldId == null) {
      kept.push(row);
      continue;
    }
    const newId = userMap[oldId];
    if (!newId) {
      console.warn(`  drop ${table} row: user ${oldId} was not migrated`);
      continue;
    }
    kept.push({ ...row, [column]: newId });
  }
  return kept;
}

for (const table of TABLES) {
  const file = Bun.file(`migration/data/${table}.json`);
  if (!(await file.exists())) continue;
  const rows = remap(table, (await file.json()) as Row[]);
  if (rows.length === 0) {
    console.log(`${table}: nothing to import`);
    continue;
  }

  if (table === "categories") {
    // combined.sql seeds default categories with fresh ids; drop the ones we are
    // about to replace by name so the source ids (referenced by products) win.
    const names = rows.map((row) => String(row["name"]));
    const ids = rows.map((row) => String(row["id"]));
    const { error: cleanupError } = await dst
      .from("categories")
      .delete()
      .in("name", names)
      .not("id", "in", `(${ids.join(",")})`);
    if (cleanupError) throw new Error(`categories cleanup: ${cleanupError.message}`);
  }


  // Upsert on id so re-runs are safe and the schema-created settings row is updated.
  const { error } = await dst.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: imported ${rows.length}`);
}

// Keep new order numbers ahead of anything already imported.
const { data: lastOrders, error: orderError } = await dst
  .from("orders")
  .select("order_number")
  .order("order_number", { ascending: false })
  .limit(1);
if (orderError) throw orderError;
const highest = Number(lastOrders?.[0]?.order_number?.replace("JB-", "") ?? 0);
if (highest > 0) {
  console.log(
    `Highest imported order number is JB-${String(highest).padStart(6, "0")}. ` +
      `Run this once against the target database:\n` +
      `  SELECT setval('public.order_number_seq', ${highest}, true);`,
  );
}

console.log("Data import complete.");

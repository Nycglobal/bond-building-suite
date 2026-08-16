/**
 * Recreates auth users in the target project (email confirmed, temporary
 * password) and writes migration/data/user-map.json mapping old id -> new id.
 * Passwords cannot be exported, so every account gets a fresh password.
 *
 * Run:
 *   TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... TEMP_PASSWORD='...' \
 *     bun migration/scripts/create-users.ts
 *
 * Optional: SKIP_EMAILS='smokeadmin@...,smokebuyer@...' to leave test accounts behind.
 */
import { createClient } from "@supabase/supabase-js";

const DST_URL = process.env["TARGET_SUPABASE_URL"]!;
const DST_KEY = process.env["TARGET_SERVICE_ROLE_KEY"]!;
const TEMP_PASSWORD = process.env["TEMP_PASSWORD"];
if (!DST_URL || !DST_KEY) throw new Error("Missing TARGET_SUPABASE_URL / TARGET_SERVICE_ROLE_KEY");
if (!TEMP_PASSWORD || TEMP_PASSWORD.length < 10)
  throw new Error("Set TEMP_PASSWORD to at least 10 characters");

const skip = new Set(
  (process.env["SKIP_EMAILS"] ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } });

type SourceUser = { id: string; email: string; meta?: Record<string, unknown> | null };
const users: SourceUser[] = await Bun.file("migration/data/auth_users.json").json();

const map: Record<string, string> = {};

// Existing accounts in the target (makes re-runs idempotent).
const existing = new Map<string, string>();
for (let page = 1; ; page++) {
  const { data, error } = await dst.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  for (const u of data.users) if (u.email) existing.set(u.email.toLowerCase(), u.id);
  if (data.users.length < 200) break;
}

for (const user of users) {
  if (skip.has(user.email.toLowerCase())) {
    console.log(`skip ${user.email}`);
    continue;
  }
  const found = existing.get(user.email.toLowerCase());
  if (found) {
    map[user.id] = found;
    console.log(`exists ${user.email}`);
    continue;
  }
  const { data, error } = await dst.auth.admin.createUser({
    email: user.email,
    password: TEMP_PASSWORD,
    email_confirm: true,
    user_metadata: user.meta ?? {},
  });
  if (error) throw new Error(`createUser ${user.email}: ${error.message}`);
  map[user.id] = data.user!.id;
  console.log(`created ${user.email}`);
}


await Bun.write("migration/data/user-map.json", JSON.stringify(map, null, 2));
console.log(`Wrote user map for ${Object.keys(map).length} users.`);

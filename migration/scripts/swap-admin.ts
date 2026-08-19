/**
 * Swaps the store administrator in a live Supabase project.
 *
 * Removes the old admin login (auth user + admin role) and creates/updates the
 * new admin with the password from NEW_ADMIN_PASSWORD, granting the admin role.
 * Idempotent — safe to re-run.
 *
 * Run (reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env):
 *   bun --env-file=.env NEW_ADMIN_PASSWORD='...' migration/scripts/swap-admin.ts
 *
 * Optional overrides:
 *   OLD_ADMIN_EMAIL='smokeadmin@accounts.jewelbrillance.app'
 *   NEW_ADMIN_USERNAME='labdia2026'
 *   NEW_ADMIN_SOURCE_ID='48f9b8e3-...'  (records the user-map.json entry)
 */
import { createClient } from "@supabase/supabase-js";

const DST_URL = process.env["TARGET_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
const DST_KEY =
  process.env["TARGET_SERVICE_ROLE_KEY"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"];
const NEW_ADMIN_PASSWORD = process.env["NEW_ADMIN_PASSWORD"];
if (!DST_URL || !DST_KEY) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
if (!NEW_ADMIN_PASSWORD || NEW_ADMIN_PASSWORD.length < 1)
  throw new Error("Set NEW_ADMIN_PASSWORD");

const ACCOUNT_DOMAIN = "accounts.jewelbrillance.app";
const OLD_ADMIN_EMAIL = (
  process.env["OLD_ADMIN_EMAIL"] ?? "smokeadmin@accounts.jewelbrillance.app"
).toLowerCase();
const NEW_ADMIN_USERNAME = (process.env["NEW_ADMIN_USERNAME"] ?? "labdia2026").toLowerCase();
const NEW_ADMIN_EMAIL = `${NEW_ADMIN_USERNAME}@${ACCOUNT_DOMAIN}`;

const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } });

async function findUserByEmail(email: string) {
  const needle = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await dst.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === needle);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
}

// 1) Remove the old admin (auth user; user_roles rows cascade on delete).
const oldAdmin = await findUserByEmail(OLD_ADMIN_EMAIL);
if (oldAdmin) {
  const { error: roleError } = await dst
    .from("user_roles")
    .delete()
    .eq("user_id", oldAdmin.id);
  if (roleError) throw new Error(`remove old admin role: ${roleError.message}`);
  const { error: delError } = await dst.auth.admin.deleteUser(oldAdmin.id);
  if (delError) throw new Error(`delete old admin: ${delError.message}`);
  console.log(`Removed old admin ${OLD_ADMIN_EMAIL} (${oldAdmin.id})`);
} else {
  console.log(`Old admin ${OLD_ADMIN_EMAIL} not found — nothing to remove`);
}

// 2) Create the new admin if missing, otherwise update the password.
let newAdmin = await findUserByEmail(NEW_ADMIN_EMAIL);
if (newAdmin) {
  const { error } = await dst.auth.admin.updateUserById(newAdmin.id, {
    password: NEW_ADMIN_PASSWORD,
  });
  if (error) throw new Error(`update new admin password: ${error.message}`);
  console.log(`Updated password for ${NEW_ADMIN_EMAIL}`);
} else {
  const { data, error } = await dst.auth.admin.createUser({
    email: NEW_ADMIN_EMAIL,
    password: NEW_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { username: NEW_ADMIN_USERNAME },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create admin");
  newAdmin = data.user;
  console.log(`Created admin ${NEW_ADMIN_EMAIL} (${newAdmin.id})`);
}

// 3) Ensure the admin role exists.
const { data: existingRole } = await dst
  .from("user_roles")
  .select("id")
  .eq("user_id", newAdmin.id)
  .eq("role", "admin")
  .maybeSingle();
if (existingRole) {
  console.log("Admin role already present");
} else {
  const { error: roleError } = await dst
    .from("user_roles")
    .insert({ user_id: newAdmin.id, role: "admin" });
  if (roleError) throw new Error(`grant admin role: ${roleError.message}`);
  console.log("Granted admin role");
}

// 4) Keep user-map.json consistent so the migration bundle maps the new admin.
const sourceId = process.env["NEW_ADMIN_SOURCE_ID"];
if (sourceId) {
  const mapPath = "migration/data/user-map.json";
  const map: Record<string, string> = await Bun.file(mapPath).json();
  if (!map[sourceId]) {
    map[sourceId] = newAdmin.id;
    await Bun.write(mapPath, JSON.stringify(map, null, 2) + "\n");
    console.log(`Recorded user-map.json: ${sourceId} -> ${newAdmin.id}`);
  }
}

console.log("Admin swap complete.");

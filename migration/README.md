# Migration bundle — move to your own Supabase project

Everything needed to rebuild this app's backend in a Supabase project you own.

```text
migration/
  schema/combined.sql       full schema, RLS, grants, functions, storage policies
  schema/2026*.sql          the original migration files, unchanged
  data/*.json               exported table rows + auth user list
  scripts/create-users.ts   recreate logins, writes user-map.json
  scripts/copy-storage.ts   copy all storage objects (373 files, ~22 MB)
  scripts/import-data.ts    import table rows with remapped user ids
  scripts/swap-admin.ts     swap the store admin in a live project
```

## Prerequisites

From the new project's settings collect:

- Project URL (`https://<ref>.supabase.co`)
- Publishable / anon key
- Service role key (secret — never commit it)
- Database connection string (for running SQL)

Export them in the shell before running any script:

```bash
export TARGET_SUPABASE_URL="https://<ref>.supabase.co"
export TARGET_SERVICE_ROLE_KEY="<service-role-key>"
export TARGET_DB_URL="postgresql://postgres:<password>@<host>:5432/postgres"
```

## Step 1 — schema

```bash
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f migration/schema/combined.sql
```

Creates: `app_role` enum, all 9 tables with grants + RLS policies, `has_role`,
`enforce_image_cap`, `next_order_number`, `order_number_seq`, the storage
policies, and the default `settings` row.

## Step 2 — storage buckets and files

```bash
bun migration/scripts/copy-storage.ts
```

Creates the private `images` and `product-images` buckets in the target and
copies every object with identical paths (`Rings/...`). Paths must match or the
catalog's signed URLs break.

## Step 3 — logins

```bash
TEMP_PASSWORD='ChooseAStrongOne123!' \
SKIP_EMAILS='smokebuyer@accounts.jewelbrillance.app' \
USER_PASSWORD_labdia2026='Jb1944#' \
bun migration/scripts/create-users.ts
```

Passwords cannot be exported, so each account is recreated with the temporary
password and pre-confirmed email. `SKIP_EMAILS` leaves any leftover smoke-test
accounts behind. Set `USER_PASSWORD_<username>` (e.g.
`USER_PASSWORD_labdia2026`) to give one account a specific password instead of
`TEMP_PASSWORD` — this is how the admin login `labdia2026` gets its real
password. Writes `migration/data/user-map.json` (old id -> new id), which the
next step needs.

### Swapping the admin in a live project

To remove the old admin and promote a new one without re-running the whole
migration, use `swap-admin.ts` (idempotent):

```bash
bun --env-file=.env NEW_ADMIN_PASSWORD='Jb1944#' migration/scripts/swap-admin.ts
```

It deletes the old admin auth user (default `smokeadmin@accounts.jewelbrillance.app`)
plus its `user_roles` rows, creates/updates `labdia2026@accounts.jewelbrillance.app`
with the given password, and grants the `admin` role. Set
`NEW_ADMIN_SOURCE_ID='48f9b8e3-6599-4ecf-84f9-d68a15644324'` to also record the
mapping in `user-map.json`.

## Step 4 — table data

```bash
bun migration/scripts/import-data.ts
```

Imports in dependency order and rewrites `user_id` on `customers`,
`user_roles`, `orders`, `cart_items`. Rows belonging to skipped users are
dropped with a warning. If it prints a `setval` line, run it against
`$TARGET_DB_URL`.

## Step 5 — auth settings in the new project

- Site URL: `https://look-book.me`
- Additional redirect URLs: `https://www.look-book.me`, `https://bond-building-suite.lovable.app`, and the preview URL
- Email confirmations: keep enabled; accounts are created pre-confirmed by the admin API
- Disable public sign-ups (accounts are admin-issued only)

## Step 6 — repoint the app

No code changes are required — every client reads env. Update:

| Variable | Scope |
| --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | new project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | new publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | new service role key (secret) |
| `VITE_SUPABASE_PROJECT_ID` / `SUPABASE_PROJECT_ID` | new project ref |

While Lovable Cloud manages this project, those values are managed for you and
cannot be overridden from `.env`; the swap happens when the project is detached
from Cloud (Cloud → Advanced → Disconnect, irreversible).

## Step 7 — verify before decommissioning

1. Admin sign-in
2. Admin → Products lists 28 styles with thumbnails
3. Admin → Categories lists 6
4. Create a customer, sign in as them
5. Catalog images render (signed URLs against the new `images` bucket)
6. Add to order, submit, confirm a `JB-` order number is generated

Keep the old backend intact for a few days as a rollback path.

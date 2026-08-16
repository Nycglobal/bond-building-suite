# Migration to Your Own Supabase Project

Move schema, data, storage, and auth from the Lovable-managed backend to a Supabase project you own, with no downtime for the current app until the switch is verified.

## What actually has to move

Verified in the current backend:

- 4 SQL migration files already in the repo (`supabase/migrations/`) — these define the whole schema, RLS policies, grants, functions (`has_role`, `enforce_image_cap`, `next_order_number`), the `app_role` enum, and the order-number sequence.
- Data is small: 6 categories, 28 products, 123 product images, 1 customer, 3 role rows, 1 settings row, 1 cart row, 0 orders.
- Storage: one bucket in use, `images`, 373 objects, ~22 MB (all ring photos). The `product-images` bucket exists but is empty.
- Auth users: the app has admin + customer logins. Password hashes are not readable from the app-level connection, so users cannot be silently copied — this is the one piece that needs a decision (see below).

## Step-by-step

**1. Create the target project**
You create a new project in your own Supabase account and note its URL, publishable (anon) key, and service-role key. Keep the service-role key private — it goes into secrets, never into code.

**2. Rebuild the schema**
Run the 4 existing migration files against the new project in filename order. Nothing is re-authored — same SQL, so tables, enum, RLS policies, grants, functions and triggers land identically.

**3. Recreate storage buckets**
Create `images` and `product-images` as private buckets in the new project, then re-apply the storage read policy that lets signed-in users read product photos.

**4. Copy storage objects**
Download all 373 objects from the current `images` bucket (preserving the `Rings/...` paths exactly, since `product_images.image_path` points at them) and upload them to the new bucket. Paths must match byte-for-byte or images break.

**5. Recreate auth users**
Passwords can't be exported. Two options — pick one:
- *Recreate + reset*: create each user in the new project with the same email/username mapping and a temporary password, then hand out new passwords. Simplest, and there are only a handful of accounts today.
- *Same passwords*: only possible if you can export `auth.users` from a Supabase-dashboard-level connection in a project you own; not available from here.

Either way, the new user IDs are different, so step 6 must run after this.

**6. Copy table data with remapped user IDs**
Insert rows in dependency order: `categories` → `products` → `product_images` → `customers` → `user_roles` → `settings` → `orders` → `order_items` → `cart_items`. Product/category/image IDs are preserved as-is; `customers.user_id`, `user_roles.user_id`, `orders.user_id`, `cart_items.user_id` are rewritten to the new auth IDs from step 5. The order-number sequence is bumped past the highest existing order number.

**7. Repoint the app**
Swap the Supabase URL, publishable key, and service-role secret to the new project. The app code itself doesn't change — every client already reads these from env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, server-side `SUPABASE_*`).

**8. Verify end to end**
Admin sign-in → products list shows 28 items with photos → categories load → create a customer → customer sign-in → catalog images render (signed URLs from the new bucket) → add to order → submit an order and confirm the `JB-` number generates. Only after this passes is the migration done.

**9. Decommission (optional, irreversible)**
Once verified, a workspace admin can disconnect Lovable Cloud from Cloud → Advanced. This permanently deletes the old database, storage, and auth. Keep the old project alive for at least a few days as a fallback.

## Technical notes

- Auth config to re-set manually in the new project: email confirmation settings, allowed redirect URLs, and site URL for the custom domains (`look-book.me`, `www.look-book.me`).
- `product_images.bucket` defaults to `product-images`; the imported ring rows carry `images`. That column must be copied verbatim, otherwise signed URLs are requested from the wrong bucket.
- RLS depends on `user_roles` rows existing for the admin, so the admin's role row must be inserted with the new user ID before admin screens will work.
- Storage copy is done via signed downloads + service-role uploads in a script, not by hand.

## Decisions needed before starting

1. Do you already have the new Supabase project created, or should the plan assume creating it first?
2. Is recreating logins with new temporary passwords acceptable, or do passwords have to carry over?
3. Should the app keep pointing at the current backend until the new one is verified (recommended), or switch immediately?

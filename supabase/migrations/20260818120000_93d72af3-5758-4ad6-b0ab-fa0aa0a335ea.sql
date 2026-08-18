-- ============================================================================
-- RLS hardening & consolidation (idempotent — safe to re-run)
-- ----------------------------------------------------------------------------
-- Consolidates the app's complete Row Level Security posture into one explicit,
-- re-runnable migration:
--
--   * Ensures RLS is enabled on every application table.
--   * Recreates every table policy (DROP IF EXISTS + CREATE) as the single
--     source of truth, matching the original migrations.
--   * FIXES a storage RLS gap: storage.objects had INSERT/UPDATE/DELETE
--     policies for the `product-images` bucket only. ALL existing product
--     images live in the `images` bucket, so admins could not upload to or
--     delete from it through the RLS-enforced client — the admin "remove
--     image" action failed with 403 "new row violates row-level security
--     policy". This adds the matching admin policies for the `images` bucket.
--   * Re-asserts table/function privileges and revokes anon/public access.
-- ============================================================================

-- 1) RLS enabled on every table (idempotent) --------------------------------
ALTER TABLE public.user_roles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings        ENABLE ROW LEVEL SECURITY;

-- 2) Privileges (idempotent) ------------------------------------------------
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.settings TO authenticated;

GRANT ALL ON public.user_roles, public.customers, public.categories,
          public.products, public.product_images, public.orders,
          public.order_items, public.cart_items, public.settings
  TO service_role;

-- 3) Function privileges ----------------------------------------------------
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.enforce_image_cap() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.next_order_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_order_number() TO service_role;

-- 4) Table policies ---------------------------------------------------------

-- user_roles: users see only their own roles; admins see all.
DROP POLICY IF EXISTS "own roles readable" ON public.user_roles;
CREATE POLICY "own roles readable" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- customers: users read only their own customer record; admins manage all.
DROP POLICY IF EXISTS "customers self read" ON public.customers;
CREATE POLICY "customers self read" ON public.customers
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins manage customers" ON public.customers;
CREATE POLICY "admins manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- categories: signed-in users read active categories; admins manage all.
DROP POLICY IF EXISTS "signed in read active categories" ON public.categories;
CREATE POLICY "signed in read active categories" ON public.categories
  FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins manage categories" ON public.categories;
CREATE POLICY "admins manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- products: signed-in users read active products; admins manage all.
DROP POLICY IF EXISTS "signed in read active products" ON public.products;
CREATE POLICY "signed in read active products" ON public.products
  FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins manage products" ON public.products;
CREATE POLICY "admins manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- product_images: any signed-in user may view image records. The catalog
-- query already restricts to active products, and image paths are not
-- sensitive, so this is kept intentionally permissive; admins manage all.
DROP POLICY IF EXISTS "signed in read product images" ON public.product_images;
CREATE POLICY "signed in read product images" ON public.product_images
  FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS "admins manage product images" ON public.product_images;
CREATE POLICY "admins manage product images" ON public.product_images
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- orders: users read only their own orders; admins manage all. New orders are
-- written server-side via the service role.
DROP POLICY IF EXISTS "own orders read" ON public.orders;
CREATE POLICY "own orders read" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "admins manage orders" ON public.orders;
CREATE POLICY "admins manage orders" ON public.orders
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- order_items: scoped through the user's own orders; admins manage all.
DROP POLICY IF EXISTS "own order items read" ON public.order_items;
CREATE POLICY "own order items read" ON public.order_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));
DROP POLICY IF EXISTS "admins manage order items" ON public.order_items;
CREATE POLICY "admins manage order items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- cart_items: users manage only their own cart.
DROP POLICY IF EXISTS "own cart" ON public.cart_items;
CREATE POLICY "own cart" ON public.cart_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- settings: admins only.
DROP POLICY IF EXISTS "admins manage settings" ON public.settings;
CREATE POLICY "admins manage settings" ON public.settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) Storage policies -------------------------------------------------------

-- `product-images` bucket: signed-in users read (signed URLs); admins manage.
DROP POLICY IF EXISTS "signed in read product image files" ON storage.objects;
CREATE POLICY "signed in read product image files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "admins write product image files" ON storage.objects;
CREATE POLICY "admins write product image files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update product image files" ON storage.objects;
CREATE POLICY "admins update product image files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete product image files" ON storage.objects;
CREATE POLICY "admins delete product image files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));

-- `images` bucket: signed-in users read; admins manage.
-- FIX: this bucket holds ALL imported product images (product_images.bucket =
-- 'images'); it previously had no INSERT/UPDATE/DELETE policies, so admin
-- image management (e.g. the "remove image" action) failed with 403.
DROP POLICY IF EXISTS "signed in read images bucket" ON storage.objects;
CREATE POLICY "signed in read images bucket" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'images');

DROP POLICY IF EXISTS "admins write images bucket" ON storage.objects;
CREATE POLICY "admins write images bucket" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update images bucket" ON storage.objects;
CREATE POLICY "admins update images bucket" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete images bucket" ON storage.objects;
CREATE POLICY "admins delete images bucket" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND public.has_role(auth.uid(), 'admin'));

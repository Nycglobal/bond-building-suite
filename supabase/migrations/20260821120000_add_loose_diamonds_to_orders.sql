-- Allow loose diamonds to use the same catalog cart and order flow as products.
ALTER TABLE public.cart_items
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS loose_diamond_id uuid REFERENCES public.loose_diamonds(id) ON DELETE CASCADE;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_product_or_loose_diamond_check,
  ADD CONSTRAINT cart_items_product_or_loose_diamond_check CHECK (
    (product_id IS NOT NULL AND loose_diamond_id IS NULL)
    OR (product_id IS NULL AND loose_diamond_id IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_user_loose_diamond_idx
  ON public.cart_items (user_id, loose_diamond_id)
  WHERE loose_diamond_id IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS loose_diamond_id uuid REFERENCES public.loose_diamonds(id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_product_or_loose_diamond_check,
  ADD CONSTRAINT order_items_product_or_loose_diamond_check CHECK (
    (product_id IS NOT NULL AND loose_diamond_id IS NULL)
    OR (product_id IS NULL AND loose_diamond_id IS NOT NULL)
  );

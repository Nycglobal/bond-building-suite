-- Add customer-facing subcategories beneath each catalog category.
CREATE TABLE IF NOT EXISTS public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.subcategories(id) ON DELETE SET NULL;

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategories TO authenticated;
GRANT ALL ON public.subcategories TO service_role;

DROP POLICY IF EXISTS "signed in read active subcategories" ON public.subcategories;
CREATE POLICY "signed in read active subcategories" ON public.subcategories
  FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage subcategories" ON public.subcategories;
CREATE POLICY "admins manage subcategories" ON public.subcategories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.categories (name, display_order, active)
VALUES ('925 Collection', 7, true)
ON CONFLICT (name) DO NOTHING;

WITH requested(category_name, subcategory_name, display_order) AS (
  VALUES
    ('Rings', 'Men''s', 1),
    ('Rings', 'Ladies''', 2),
    ('Rings', 'Solitaire Rings', 3),
    ('Rings', 'Fashion Rings', 4),
    ('Rings', 'Eternity Rings', 5),
    ('Rings', 'Bands', 6),
    ('Earrings', 'Diamond Solitaire Earrings', 1),
    ('Earrings', 'Diamond Huggies', 2),
    ('Earrings', 'Fashion Earrings', 3),
    ('Bracelets', 'Tennis Bracelets', 1),
    ('Bracelets', 'Fashion Bracelets', 2),
    ('Bracelets', 'Men''s Bracelets', 3),
    ('Necklaces', 'Solitaire Necklaces', 1),
    ('Necklaces', 'Tennis Necklaces', 2),
    ('Necklaces', 'Fashion Necklaces', 3),
    ('925 Collection', 'Rings', 1),
    ('925 Collection', 'Earrings', 2),
    ('925 Collection', 'Bracelet', 3)
)
INSERT INTO public.subcategories (category_id, name, display_order)
SELECT c.id, r.subcategory_name, r.display_order
FROM requested r
JOIN public.categories c ON c.name = r.category_name
ON CONFLICT (category_id, name) DO NOTHING;
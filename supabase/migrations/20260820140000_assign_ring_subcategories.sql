-- Assign existing Rings products to the closest matching subcategory so the
-- customer sidebar filters are useful immediately after migration.
WITH ring_category AS (
  SELECT id FROM public.categories WHERE name = 'Rings'
),
ring_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM ring_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM ring_subcategories AS s
WHERE p.category_id = (SELECT id FROM ring_category)
  AND p.subcategory_id IS NULL
  AND (
    (s.name = 'Solitaire Rings' AND p.product_name ILIKE '%solitaire%')
    OR (s.name = 'Eternity Rings' AND p.product_name ILIKE '%eternity%')
    OR (s.name = 'Bands' AND p.product_name ILIKE '%band%')
  );

-- Any remaining Rings products are visible under Fashion Rings until an admin
-- assigns a more specific subcategory from the product editor.
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM public.subcategories AS s
JOIN public.categories AS c ON c.id = s.category_id
WHERE c.name = 'Rings'
  AND s.name = 'Fashion Rings'
  AND p.category_id = c.id
  AND p.subcategory_id IS NULL;
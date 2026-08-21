-- Assign existing Bracelet products so sidebar subcategory links return data.
WITH bracelet_category AS (
  SELECT id FROM public.categories WHERE name = 'Bracelets'
), bracelet_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM bracelet_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM bracelet_subcategories AS s
WHERE p.category_id = (SELECT id FROM bracelet_category)
  AND p.subcategory_id IS NULL
  AND s.name = 'Tennis Bracelets'
  AND p.product_name ILIKE '%tennis%';

WITH bracelet_category AS (
  SELECT id FROM public.categories WHERE name = 'Bracelets'
), bracelet_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM bracelet_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM bracelet_subcategories AS s
WHERE p.category_id = (SELECT id FROM bracelet_category)
  AND p.subcategory_id IS NULL
  AND s.name = 'Men''s Bracelets'
  AND (
    p.product_name ILIKE '%men%'
    OR p.product_name ILIKE '%mens%'
    OR p.style_number ILIKE 'AR%'
  );

-- Keep every remaining Bracelet product discoverable from a subcategory.
WITH bracelet_category AS (
  SELECT id FROM public.categories WHERE name = 'Bracelets'
), fashion_subcategory AS (
  SELECT s.id
  FROM public.subcategories AS s
  JOIN bracelet_category AS c ON c.id = s.category_id
  WHERE s.name = 'Fashion Bracelets'
)
UPDATE public.products AS p
SET subcategory_id = (SELECT id FROM fashion_subcategory),
    updated_at = now()
WHERE p.category_id = (SELECT id FROM bracelet_category)
  AND p.subcategory_id IS NULL;

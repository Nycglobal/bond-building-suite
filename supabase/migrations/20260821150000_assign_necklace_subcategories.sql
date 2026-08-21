-- Assign existing Necklace products so sidebar subcategory links return data.
WITH necklace_category AS (
  SELECT id FROM public.categories WHERE name = 'Necklaces'
), necklace_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM necklace_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM necklace_subcategories AS s
WHERE p.category_id = (SELECT id FROM necklace_category)
  AND p.subcategory_id IS NULL
  AND s.name = 'Solitaire Necklaces'
  AND p.product_name ILIKE '%solitaire%';

WITH necklace_category AS (
  SELECT id FROM public.categories WHERE name = 'Necklaces'
), necklace_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM necklace_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM necklace_subcategories AS s
WHERE p.category_id = (SELECT id FROM necklace_category)
  AND p.subcategory_id IS NULL
  AND s.name = 'Tennis Necklaces'
  AND p.product_name ILIKE '%tennis%';

-- Keep every remaining Necklace product discoverable from a subcategory.
WITH necklace_category AS (
  SELECT id FROM public.categories WHERE name = 'Necklaces'
), fashion_subcategory AS (
  SELECT s.id
  FROM public.subcategories AS s
  JOIN necklace_category AS c ON c.id = s.category_id
  WHERE s.name = 'Fashion Necklaces'
)
UPDATE public.products AS p
SET subcategory_id = (SELECT id FROM fashion_subcategory),
    updated_at = now()
WHERE p.category_id = (SELECT id FROM necklace_category)
  AND p.subcategory_id IS NULL;

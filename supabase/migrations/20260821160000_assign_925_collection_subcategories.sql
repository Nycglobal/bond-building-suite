-- Assign existing 925 Collection products so subcategory links return data.
WITH collection_category AS (
  SELECT id FROM public.categories WHERE name = '925 Collection'
), collection_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM collection_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM collection_subcategories AS s
WHERE p.category_id = (SELECT id FROM collection_category)
  AND p.subcategory_id IS NULL
  AND s.name = 'Earrings'
  AND (
    p.product_name ILIKE '%earring%'
    OR p.product_name ILIKE '%hugg%'
    OR p.product_name ILIKE '%stud%'
  );

WITH collection_category AS (
  SELECT id FROM public.categories WHERE name = '925 Collection'
), collection_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM collection_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM collection_subcategories AS s
WHERE p.category_id = (SELECT id FROM collection_category)
  AND p.subcategory_id IS NULL
  AND s.name = 'Bracelet'
  AND p.product_name ILIKE '%bracelet%';

-- Keep every remaining 925 Collection product discoverable under Rings.
WITH collection_category AS (
  SELECT id FROM public.categories WHERE name = '925 Collection'
), rings_subcategory AS (
  SELECT s.id
  FROM public.subcategories AS s
  JOIN collection_category AS c ON c.id = s.category_id
  WHERE s.name = 'Rings'
)
UPDATE public.products AS p
SET subcategory_id = (SELECT id FROM rings_subcategory),
    updated_at = now()
WHERE p.category_id = (SELECT id FROM collection_category)
  AND p.subcategory_id IS NULL;

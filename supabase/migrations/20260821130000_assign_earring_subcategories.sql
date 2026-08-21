-- Assign existing Earrings products so sidebar subcategory links return data.
WITH earring_category AS (
  SELECT id FROM public.categories WHERE name = 'Earrings'
), earring_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM earring_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM earring_subcategories AS s
WHERE p.category_id = (SELECT id FROM earring_category)
  AND p.subcategory_id IS NULL
  AND s.name = 'Diamond Solitaire Earrings'
  AND (
    p.product_name ILIKE '%solitaire%'
    OR p.product_name ILIKE '%stud%'
  );

WITH earring_category AS (
  SELECT id FROM public.categories WHERE name = 'Earrings'
), earring_subcategories AS (
  SELECT id, name FROM public.subcategories
  WHERE category_id = (SELECT id FROM earring_category)
)
UPDATE public.products AS p
SET subcategory_id = s.id,
    updated_at = now()
FROM earring_subcategories AS s
WHERE p.category_id = (SELECT id FROM earring_category)
  AND p.subcategory_id IS NULL
  AND s.name = 'Diamond Huggies'
  AND p.product_name ILIKE '%hugg%';

-- Keep every remaining Earrings product discoverable from a subcategory.
WITH earring_category AS (
  SELECT id FROM public.categories WHERE name = 'Earrings'
), fashion_subcategory AS (
  SELECT s.id
  FROM public.subcategories AS s
  JOIN earring_category AS c ON c.id = s.category_id
  WHERE s.name = 'Fashion Earrings'
)
UPDATE public.products AS p
SET subcategory_id = (SELECT id FROM fashion_subcategory),
    updated_at = now()
WHERE p.category_id = (SELECT id FROM earring_category)
  AND p.subcategory_id IS NULL;

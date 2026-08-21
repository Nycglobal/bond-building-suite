-- Loose diamond inventory imported from the attached CSV files.
-- Import the three *_carat_diamonds.csv files directly into this table after
-- running the migration. The separate diamonds.csv is only an image index.
CREATE TABLE IF NOT EXISTS public.loose_diamonds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page integer,
  category text,
  item_number text,
  carat_weight numeric(8,2),
  shape text,
  cut_style text,
  color_grade text,
  clarity_grade text,
  report_number text,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loose_diamonds_carat_weight_idx
  ON public.loose_diamonds (carat_weight);

ALTER TABLE public.loose_diamonds ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.loose_diamonds TO authenticated;
GRANT ALL ON public.loose_diamonds TO service_role;

DROP POLICY IF EXISTS "signed in read loose diamonds" ON public.loose_diamonds;
CREATE POLICY "signed in read loose diamonds" ON public.loose_diamonds
  FOR SELECT TO authenticated USING (true);

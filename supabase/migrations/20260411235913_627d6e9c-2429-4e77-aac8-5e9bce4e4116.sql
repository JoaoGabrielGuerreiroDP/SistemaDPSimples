
CREATE TABLE public.sales_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_key text NOT NULL,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_key, user_id, emoji)
);

ALTER TABLE public.sales_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reactions"
  ON public.sales_reactions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can add own reactions"
  ON public.sales_reactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.sales_reactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_sales_reactions_sale_key ON public.sales_reactions (sale_key);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_reactions;

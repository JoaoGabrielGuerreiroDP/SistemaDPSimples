
-- Remove old constraint that allowed multiple emojis per user
ALTER TABLE public.sales_reactions DROP CONSTRAINT IF EXISTS sales_reactions_sale_key_user_id_emoji_key;

-- Add new constraint: 1 reaction per user per sale
ALTER TABLE public.sales_reactions ADD CONSTRAINT sales_reactions_sale_key_user_id_key UNIQUE (sale_key, user_id);

-- Clean up any existing duplicates (keep latest)
DELETE FROM public.sales_reactions a
USING public.sales_reactions b
WHERE a.sale_key = b.sale_key
  AND a.user_id = b.user_id
  AND a.created_at < b.created_at;

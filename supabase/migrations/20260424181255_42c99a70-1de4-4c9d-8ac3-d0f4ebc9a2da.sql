ALTER TABLE public.simulador_grupos
ADD COLUMN IF NOT EXISTS admin_fee_percent numeric NOT NULL DEFAULT 0;
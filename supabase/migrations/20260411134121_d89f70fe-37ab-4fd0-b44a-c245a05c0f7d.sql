
-- Add email columns to hub_partners
ALTER TABLE public.hub_partners
  ADD COLUMN email_membro text,
  ADD COLUMN email_afiliado text;

-- Create indexes for email lookups
CREATE INDEX idx_hub_partners_email_membro ON public.hub_partners (email_membro);
CREATE INDEX idx_hub_partners_email_afiliado ON public.hub_partners (email_afiliado);

-- Policy: members can view their own partner record by matching email
CREATE POLICY "Members can view own partner data"
  ON public.hub_partners FOR SELECT TO authenticated
  USING (email_membro = auth.email());

-- Policy: affiliates can view all partners they referred
CREATE POLICY "Affiliates can view referred partners"
  ON public.hub_partners FOR SELECT TO authenticated
  USING (email_afiliado = auth.email());

-- 1. Backfill: copia os parceiros existentes do HUB para partners_onboarding
INSERT INTO public.partners_onboarding (name, status, notes)
SELECT 
  hp.nome,
  'cadastro',
  CASE WHEN hp.cidade IS NOT NULL THEN 'Cidade: ' || hp.cidade ELSE NULL END
FROM public.hub_partners hp
WHERE NOT EXISTS (
  SELECT 1 FROM public.partners_onboarding po WHERE po.name = hp.nome
);

-- 2. Função que sincroniza novos parceiros do HUB para partners_onboarding
CREATE OR REPLACE FUNCTION public.sync_hub_partner_to_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.partners_onboarding (name, status, notes)
  SELECT 
    NEW.nome,
    'cadastro',
    CASE WHEN NEW.cidade IS NOT NULL THEN 'Cidade: ' || NEW.cidade ELSE NULL END
  WHERE NOT EXISTS (
    SELECT 1 FROM public.partners_onboarding WHERE name = NEW.nome
  );
  RETURN NEW;
END;
$$;

-- 3. Trigger no INSERT do hub_partners
DROP TRIGGER IF EXISTS trg_sync_hub_partner_to_onboarding ON public.hub_partners;
CREATE TRIGGER trg_sync_hub_partner_to_onboarding
AFTER INSERT ON public.hub_partners
FOR EACH ROW
EXECUTE FUNCTION public.sync_hub_partner_to_onboarding();
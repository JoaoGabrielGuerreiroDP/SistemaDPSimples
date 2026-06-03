
CREATE OR REPLACE FUNCTION public.log_hub_partner_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  changes TEXT[] := '{}';
  change_type TEXT := 'Atualização';
  adm_val TEXT := 'Todas';
BEGIN
  -- Track etapa changes
  IF OLD.etapa IS DISTINCT FROM NEW.etapa THEN
    changes := array_append(changes, 'Etapa: ' || COALESCE(OLD.etapa, '—') || ' → ' || COALESCE(NEW.etapa, '—'));
    change_type := 'Mudança de Etapa';
  END IF;

  -- Track status changes
  IF OLD.status_mag IS DISTINCT FROM NEW.status_mag THEN
    changes := array_append(changes, 'Magalu: ' || COALESCE(OLD.status_mag, '—') || ' → ' || COALESCE(NEW.status_mag, '—'));
    adm_val := 'Magalu';
  END IF;
  IF OLD.status_anc IS DISTINCT FROM NEW.status_anc THEN
    changes := array_append(changes, 'Âncora: ' || COALESCE(OLD.status_anc, '—') || ' → ' || COALESCE(NEW.status_anc, '—'));
    adm_val := CASE WHEN adm_val = 'Todas' THEN 'Âncora' ELSE 'Todas' END;
  END IF;
  IF OLD.status_can IS DISTINCT FROM NEW.status_can THEN
    changes := array_append(changes, 'Canopus: ' || COALESCE(OLD.status_can, '—') || ' → ' || COALESCE(NEW.status_can, '—'));
    adm_val := CASE WHEN adm_val = 'Todas' THEN 'Canopus' ELSE 'Todas' END;
  END IF;

  -- Track docs changes
  IF OLD.docs_mag IS DISTINCT FROM NEW.docs_mag THEN
    changes := array_append(changes, 'Docs Magalu: ' || COALESCE(OLD.docs_mag, '—') || ' → ' || COALESCE(NEW.docs_mag, '—'));
  END IF;
  IF OLD.docs_anc IS DISTINCT FROM NEW.docs_anc THEN
    changes := array_append(changes, 'Docs Âncora: ' || COALESCE(OLD.docs_anc, '—') || ' → ' || COALESCE(NEW.docs_anc, '—'));
  END IF;
  IF OLD.docs_can IS DISTINCT FROM NEW.docs_can THEN
    changes := array_append(changes, 'Docs Canopus: ' || COALESCE(OLD.docs_can, '—') || ' → ' || COALESCE(NEW.docs_can, '—'));
  END IF;

  -- Track responsavel
  IF OLD.responsavel IS DISTINCT FROM NEW.responsavel THEN
    changes := array_append(changes, 'Responsável: ' || COALESCE(OLD.responsavel, '—') || ' → ' || COALESCE(NEW.responsavel, '—'));
  END IF;

  -- Track prox_acao
  IF OLD.prox_acao IS DISTINCT FROM NEW.prox_acao THEN
    changes := array_append(changes, 'Próxima ação atualizada');
  END IF;

  -- Track prazo
  IF OLD.prazo IS DISTINCT FROM NEW.prazo THEN
    changes := array_append(changes, 'Prazo: ' || COALESCE(OLD.prazo::text, '—') || ' → ' || COALESCE(NEW.prazo::text, '—'));
  END IF;

  -- Track metas
  IF OLD.meta_mag IS DISTINCT FROM NEW.meta_mag OR OLD.meta_anc IS DISTINCT FROM NEW.meta_anc OR OLD.meta_can IS DISTINCT FROM NEW.meta_can THEN
    changes := array_append(changes, 'Metas atualizadas');
  END IF;

  -- Only insert if there were actual changes
  IF array_length(changes, 1) > 0 THEN
    INSERT INTO public.hub_historico (partner_id, tipo, acao, adm, responsavel, etapa, status_mag, status_anc, status_can)
    VALUES (
      NEW.id,
      change_type,
      array_to_string(changes, ' | '),
      adm_val,
      NEW.responsavel,
      NEW.etapa,
      NEW.status_mag,
      NEW.status_anc,
      NEW.status_can
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_hub_partner_changes
  AFTER UPDATE ON public.hub_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.log_hub_partner_changes();

-- Also log new partner creation
CREATE OR REPLACE FUNCTION public.log_hub_partner_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.hub_historico (partner_id, tipo, acao, responsavel, etapa, status_mag, status_anc, status_can)
  VALUES (
    NEW.id,
    'Cadastro',
    'Parceiro cadastrado: ' || NEW.nome,
    NEW.responsavel,
    NEW.etapa,
    NEW.status_mag,
    NEW.status_anc,
    NEW.status_can
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_hub_partner_creation
  AFTER INSERT ON public.hub_partners
  FOR EACH ROW
  EXECUTE FUNCTION public.log_hub_partner_creation();

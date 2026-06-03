
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- account_approvals table
CREATE TABLE IF NOT EXISTS public.account_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  avatar_url text,
  status public.approval_status NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by uuid
);

ALTER TABLE public.account_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins/gestors manage approvals" ON public.account_approvals;
CREATE POLICY "Admins/gestors manage approvals"
ON public.account_approvals
FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "Users view own approval" ON public.account_approvals;
CREATE POLICY "Users view own approval"
ON public.account_approvals
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.account_approvals;

-- Replace handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _role app_role := 'vendedor';
  _adm_emails TEXT[] := ARRAY[
    'davigoncalves@dpconsorcios.com.br',
    'ketlynhendler@dpconsorcios.com.br',
    'laratiscoski@dpconsorcios.com.br',
    'renan@dpconsorcios.com.br',
    'stefany@dpconsorcios.com.br'
  ];
  _display text;
  _avatar text;
  _is_internal boolean;
  _gestor RECORD;
BEGIN
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'E-mail obrigatório';
  END IF;

  _display := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.email);
  _avatar := NEW.raw_user_meta_data->>'avatar_url';
  _is_internal := NEW.email LIKE '%@dpconsorcios.com.br';

  -- Always upsert profile
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (NEW.id, _display, _avatar, NEW.email)
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email = COALESCE(EXCLUDED.email, profiles.email);

  IF _is_internal THEN
    IF NEW.email = ANY(_adm_emails) THEN
      _role := 'gestor';
    END IF;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, _role)
    ON CONFLICT DO NOTHING;

    IF _role = 'gestor' THEN
      INSERT INTO public.user_permissions (user_id, permission)
      VALUES (NEW.id,'vendas'),(NEW.id,'meu_painel'),(NEW.id,'financeiro'),(NEW.id,'hub')
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.user_permissions (user_id, permission)
      VALUES (NEW.id,'vendas'),(NEW.id,'meu_painel')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    -- External email → create pending approval and notify gestors/admins
    INSERT INTO public.account_approvals (user_id, email, display_name, avatar_url, status)
    VALUES (NEW.id, NEW.email, _display, _avatar, 'pending')
    ON CONFLICT (user_id) DO NOTHING;

    FOR _gestor IN
      SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin','gestor')
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, metadata)
      VALUES (
        _gestor.user_id,
        'account_approval_request',
        'Nova solicitação de acesso',
        _display || ' (' || NEW.email || ') está aguardando aprovação.',
        jsonb_build_object('approval_user_id', NEW.id, 'email', NEW.email)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Approve
CREATE OR REPLACE FUNCTION public.approve_account(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor')) THEN
    RAISE EXCEPTION 'Apenas gestores podem aprovar contas';
  END IF;

  UPDATE public.account_approvals
  SET status = 'approved', decided_at = now(), decided_by = auth.uid()
  WHERE user_id = _user_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'vendedor')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_permissions (user_id, permission)
  VALUES (_user_id, 'vendas'), (_user_id, 'meu_painel')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (_user_id, 'account_approved', 'Acesso liberado!', 'Sua solicitação de acesso foi aprovada. Recarregue a página.');
END;
$$;

-- Reject
CREATE OR REPLACE FUNCTION public.reject_account(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor')) THEN
    RAISE EXCEPTION 'Apenas gestores podem rejeitar contas';
  END IF;

  UPDATE public.account_approvals
  SET status = 'rejected', decided_at = now(), decided_by = auth.uid()
  WHERE user_id = _user_id;

  -- Remove from auth.users (cascade cleans related rows)
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;

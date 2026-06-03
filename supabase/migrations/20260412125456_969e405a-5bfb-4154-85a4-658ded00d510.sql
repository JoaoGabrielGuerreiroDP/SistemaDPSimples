
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role app_role := 'vendedor';
  _adm_emails TEXT[] := ARRAY[
    'davigoncalves@dpconsorcios.com.br',
    'ketlynhendler@dpconsorcios.com.br',
    'laratiscoski@dpconsorcios.com.br',
    'renan@dpconsorcios.com.br',
    'stefany@dpconsorcios.com.br'
  ];
BEGIN
  -- Upsert profile
  INSERT INTO public.profiles (user_id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    email = COALESCE(EXCLUDED.email, profiles.email);

  -- Check if ADM email
  IF NEW.email = ANY(_adm_emails) THEN
    _role := 'gestor';
  END IF;

  -- Auto-assign role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT DO NOTHING;

  -- Auto-assign permissions based on role
  IF _role = 'gestor' THEN
    INSERT INTO public.user_permissions (user_id, permission)
    VALUES (NEW.id, 'vendas'), (NEW.id, 'meu_painel'), (NEW.id, 'financeiro'), (NEW.id, 'hub')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_permissions (user_id, permission)
    VALUES (NEW.id, 'vendas'), (NEW.id, 'meu_painel')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

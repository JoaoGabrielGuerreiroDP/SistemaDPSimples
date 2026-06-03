
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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

  -- Auto-assign vendedor role if no role exists
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'vendedor')
  ON CONFLICT DO NOTHING;

  -- Auto-assign vendas and meu_painel permissions
  INSERT INTO public.user_permissions (user_id, permission)
  VALUES (NEW.id, 'vendas'), (NEW.id, 'meu_painel')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

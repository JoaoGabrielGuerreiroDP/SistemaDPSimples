
REVOKE ALL ON FUNCTION public.approve_account(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_account(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_account(uuid) TO authenticated;

-- Allow admins to delete quiz results
CREATE POLICY "Admins can delete quiz results"
ON public.training_quiz_results
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Allow admins to delete watch status for any user
CREATE POLICY "Admins can delete any watch status"
ON public.training_watch_status
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Allow admins to delete any comments
CREATE POLICY "Gestors can delete any comment"
ON public.training_comments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'gestor'::app_role));

-- Allow admins to delete any notes (for student removal)
CREATE POLICY "Admins can delete any notes"
ON public.training_notes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Allow admins to delete any ratings
CREATE POLICY "Admins can delete any ratings"
ON public.training_ratings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Add assigned_to column to key_results
ALTER TABLE public.key_results
ADD COLUMN assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Allow assigned users to view key_results assigned to them
CREATE POLICY "Assigned users can view their key_results"
ON public.key_results
FOR SELECT
TO authenticated
USING (assigned_to = auth.uid());

-- Allow assigned users to update key_results assigned to them
CREATE POLICY "Assigned users can update their key_results"
ON public.key_results
FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid());

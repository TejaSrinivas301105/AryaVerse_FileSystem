CREATE INDEX IF NOT EXISTS idx_access_requests_file_id ON public.access_requests (file_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_file_id ON public.audit_logs (file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_file_id ON public.file_access (file_id);
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON public.folders (created_by);

DROP POLICY IF EXISTS employee_own_user ON public.users;
CREATE POLICY employee_own_user
ON public.users
FOR SELECT
TO authenticated
USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS employee_own_requests ON public.access_requests;
CREATE POLICY employee_own_requests
ON public.access_requests
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS employee_insert_requests ON public.access_requests;
CREATE POLICY employee_insert_requests
ON public.access_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS employee_own_access ON public.file_access;
CREATE POLICY employee_own_access
ON public.file_access
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS employee_own_logs ON public.audit_logs;
CREATE POLICY employee_own_logs
ON public.audit_logs
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

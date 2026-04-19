CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.folders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_name text NOT NULL UNIQUE,
    created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.files (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name text NOT NULL,
    file_url text NOT NULL,
    folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
    uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.access_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.file_access (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    file_id uuid REFERENCES public.files(id) ON DELETE CASCADE,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT file_access_user_file_unique UNIQUE (user_id, file_id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
    action text NOT NULL,
    accessed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_created_at ON public.files (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_folder_id ON public.files (folder_id);
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON public.files (uploaded_by);
CREATE INDEX IF NOT EXISTS idx_access_requests_status_requested_at ON public.access_requests (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_requests_user_file_status ON public.access_requests (user_id, file_id, status);
CREATE INDEX IF NOT EXISTS idx_access_requests_file_id ON public.access_requests (file_id);
CREATE INDEX IF NOT EXISTS idx_file_access_user_file_expires ON public.file_access (user_id, file_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_file_access_expires_at ON public.file_access (expires_at);
CREATE INDEX IF NOT EXISTS idx_file_access_file_id ON public.file_access (file_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_accessed_at ON public.audit_logs (user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_file_id ON public.audit_logs (file_id);
CREATE INDEX IF NOT EXISTS idx_folders_created_by ON public.folders (created_by);

CREATE UNIQUE INDEX IF NOT EXISTS uq_access_requests_pending
ON public.access_requests (user_id, file_id)
WHERE status = 'pending';

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_file_access(fid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.file_access
    WHERE user_id = auth.uid()
      AND file_id = fid
      AND expires_at > now()
  );
$$;

DROP POLICY IF EXISTS service_role_users ON public.users;
DROP POLICY IF EXISTS employee_own_user ON public.users;
CREATE POLICY service_role_users ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_own_user ON public.users FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS service_role_files ON public.files;
DROP POLICY IF EXISTS employee_accessible_files ON public.files;
CREATE POLICY service_role_files ON public.files FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_accessible_files ON public.files FOR SELECT TO authenticated USING (public.has_file_access(id));

DROP POLICY IF EXISTS service_role_folders ON public.folders;
DROP POLICY IF EXISTS employee_accessible_folders ON public.folders;
CREATE POLICY service_role_folders ON public.folders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_accessible_folders ON public.folders FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM public.files f
        WHERE f.folder_id = public.folders.id
          AND public.has_file_access(f.id)
    )
);

DROP POLICY IF EXISTS service_role_requests ON public.access_requests;
DROP POLICY IF EXISTS employee_own_requests ON public.access_requests;
DROP POLICY IF EXISTS employee_insert_requests ON public.access_requests;
CREATE POLICY service_role_requests ON public.access_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_own_requests ON public.access_requests FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY employee_insert_requests ON public.access_requests FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS service_role_file_access ON public.file_access;
DROP POLICY IF EXISTS employee_own_access ON public.file_access;
CREATE POLICY service_role_file_access ON public.file_access FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_own_access ON public.file_access FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS service_role_logs ON public.audit_logs;
DROP POLICY IF EXISTS employee_own_logs ON public.audit_logs;
CREATE POLICY service_role_logs ON public.audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY employee_own_logs ON public.audit_logs FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('files', 'files', true, 104857600)
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS service_role_files_bucket_all ON storage.objects;
CREATE POLICY service_role_files_bucket_all
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'files')
WITH CHECK (bucket_id = 'files');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data ->> 'role', 'employee')
  )
  ON CONFLICT (id)
  DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.users (id, email, role)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_app_meta_data ->> 'role', 'employee') AS role
FROM auth.users au
ON CONFLICT (id)
DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role;

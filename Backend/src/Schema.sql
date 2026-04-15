-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (synced from Supabase Auth via trigger)
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
    created_at timestamp DEFAULT now()
);

-- Folders table (optional folder-based access like Google Drive)
CREATE TABLE IF NOT EXISTS folders (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_name text NOT NULL,
    created_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now()
); 

-- Files table
CREATE TABLE IF NOT EXISTS files (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name text NOT NULL,
    file_url text NOT NULL,
    folder_id uuid REFERENCES folders(id) ON DELETE SET NULL,
    uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp DEFAULT now()
);

-- Access requests table
CREATE TABLE IF NOT EXISTS access_requests (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    file_id uuid REFERENCES files(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_at timestamp DEFAULT now()
);

-- File access control table (time-bound)
CREATE TABLE IF NOT EXISTS file_access (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    file_id uuid REFERENCES files(id) ON DELETE CASCADE,
    expires_at timestamp NOT NULL,
    created_at timestamp DEFAULT now()
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    action text NOT NULL,
    accessed_at timestamp DEFAULT now()
);

-- ===================== ROW LEVEL SECURITY =====================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: check if employee has active access to a file
CREATE OR REPLACE FUNCTION has_file_access(fid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM file_access
    WHERE user_id = auth.uid()
      AND file_id = fid
      AND expires_at > now()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- *** Service role bypasses RLS entirely — all backend operations use service role key ***
-- Users
DROP POLICY IF EXISTS "admin_all_users" ON users;
DROP POLICY IF EXISTS "employee_own_user" ON users;
CREATE POLICY "service_role_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "employee_own_user" ON users FOR SELECT USING (id = auth.uid());

-- Files
DROP POLICY IF EXISTS "admin_all_files" ON files;
DROP POLICY IF EXISTS "employee_accessible_files" ON files;
CREATE POLICY "service_role_files" ON files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "employee_accessible_files" ON files FOR SELECT USING (has_file_access(id));

-- Folders
DROP POLICY IF EXISTS "admin_all_folders" ON folders;
DROP POLICY IF EXISTS "employee_accessible_folders" ON folders;
CREATE POLICY "service_role_folders" ON folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "employee_accessible_folders" ON folders FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM files f
        WHERE f.folder_id = folders.id AND has_file_access(f.id)
    )
);

-- Access requests
DROP POLICY IF EXISTS "admin_all_requests" ON access_requests;
DROP POLICY IF EXISTS "employee_own_requests" ON access_requests;
DROP POLICY IF EXISTS "employee_insert_requests" ON access_requests;
CREATE POLICY "service_role_requests" ON access_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "employee_own_requests" ON access_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "employee_insert_requests" ON access_requests FOR INSERT WITH CHECK (user_id = auth.uid());

-- File access
DROP POLICY IF EXISTS "admin_all_access" ON file_access;
DROP POLICY IF EXISTS "employee_own_access" ON file_access;
CREATE POLICY "service_role_file_access" ON file_access FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "employee_own_access" ON file_access FOR SELECT USING (user_id = auth.uid());

-- Audit logs
DROP POLICY IF EXISTS "admin_all_logs" ON audit_logs;
DROP POLICY IF EXISTS "employee_own_logs" ON audit_logs;
CREATE POLICY "service_role_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "employee_own_logs" ON audit_logs FOR SELECT USING (user_id = auth.uid());

-- ===================== AUTO SYNC AUTH USERS =====================

-- Trigger to auto-insert into users table when a new Supabase Auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO users (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

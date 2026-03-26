-- Run this in Supabase Dashboard → SQL Editor
-- This enables public read access for shared BRDs

-- 1. Add share_token column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- 2. Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token);

-- 3. Allow anyone to SELECT a project by share_token
CREATE POLICY "Allow public read via share_token" ON projects
  FOR SELECT USING (share_token IS NOT NULL AND share_token != '');

-- 4. Allow public read on related tables when the parent project has a share_token
CREATE POLICY "Allow public read requirements via shared project" ON requirements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = requirements.project_id AND projects.share_token IS NOT NULL AND projects.share_token != '')
  );

CREATE POLICY "Allow public read stakeholders via shared project" ON stakeholders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = stakeholders.project_id AND projects.share_token IS NOT NULL AND projects.share_token != '')
  );

CREATE POLICY "Allow public read decisions via shared project" ON decisions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = decisions.project_id AND projects.share_token IS NOT NULL AND projects.share_token != '')
  );

CREATE POLICY "Allow public read timeline_events via shared project" ON timeline_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = timeline_events.project_id AND projects.share_token IS NOT NULL AND projects.share_token != '')
  );

CREATE POLICY "Allow public read conflicts via shared project" ON conflicts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = conflicts.project_id AND projects.share_token IS NOT NULL AND projects.share_token != '')
  );

CREATE POLICY "Allow public read documents via shared project" ON documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = documents.project_id AND projects.share_token IS NOT NULL AND projects.share_token != '')
  );

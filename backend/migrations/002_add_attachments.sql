-- Add attachments column to tasks table
ALTER TABLE tasks ADD COLUMN attachments TEXT DEFAULT '[]';
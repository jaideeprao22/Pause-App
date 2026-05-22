-- ============================================================
-- PAUSE App — IEC §13 compliance migration
-- Run ONCE in Supabase Dashboard → SQL Editor before deploying
-- the updated app code (state.js v IEC).
-- ============================================================

-- Add IEC version-control columns to Assessments
ALTER TABLE "Assessments"
  ADD COLUMN IF NOT EXISTS consent_version    TEXT,
  ADD COLUMN IF NOT EXISTS consent_timestamp  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS app_version        TEXT,
  ADD COLUMN IF NOT EXISTS scale_version      TEXT;

-- (Optional but recommended) Drop the email column from Assessments now that
-- the app no longer writes it. This permanently removes any historical email
-- values from the research dataset, aligning with IEC §13 identifier separation.
-- COMMENT OUT this line if you want to keep historical emails until the IEC
-- review and physically delete the column later.
ALTER TABLE "Assessments" DROP COLUMN IF EXISTS email;

-- Sanity check (run after the ALTERs above):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'Assessments'
-- ORDER BY ordinal_position;

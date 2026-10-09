-- Full-funnel dial outcomes. Nullable so existing coaching calls keep their core outcome
-- and are classified from it until a manager logs an explicit dial result.
-- Safe to run once. The app also adds the column on startup when it is missing.
ALTER TABLE calls ADD COLUMN dial_outcome TEXT;

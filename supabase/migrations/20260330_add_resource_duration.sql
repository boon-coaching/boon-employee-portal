-- Add duration column to resources table
ALTER TABLE resources ADD COLUMN IF NOT EXISTS duration text;

-- Seed durations for existing resources
UPDATE resources SET duration = CASE resource_type
  WHEN 'article' THEN '5 min read'
  WHEN 'video' THEN '12 min watch'
  WHEN 'podcast' THEN '25 min listen'
  WHEN 'framework' THEN '10 min read'
  WHEN 'worksheet' THEN '15 min activity'
  WHEN 'guide' THEN '7 min read'
  ELSE '5 min'
END
WHERE duration IS NULL;

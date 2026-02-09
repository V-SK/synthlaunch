-- Add SOUL.md storage for hosted agents

ALTER TABLE hosted_agents
ADD COLUMN IF NOT EXISTS soul_md TEXT;

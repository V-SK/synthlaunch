-- Phase Eva: Agents Table for Agent Chat
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  token_address TEXT UNIQUE NOT NULL,
  nfa_id INTEGER,
  name TEXT DEFAULT 'Agent',
  avatar_url TEXT,
  persona_prompt TEXT DEFAULT 'You are a friendly AI agent.',
  tone TEXT DEFAULT 'friendly',
  language TEXT DEFAULT 'zh',
  chat_threshold BIGINT DEFAULT 1000,
  owner_address TEXT,
  tier TEXT DEFAULT 'lite',
  total_chats INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_token ON agents(token_address);
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_address);

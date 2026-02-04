-- Phase 3: Standard Agent Configuration Table
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS agent_configs (
    id SERIAL PRIMARY KEY,
    nfa_id INTEGER NOT NULL UNIQUE,              -- NFALite tokenId
    token_address VARCHAR(42) NOT NULL,          -- tax token 地址
    vault_address VARCHAR(42) NOT NULL,          -- SynthVault 地址
    agent_wallet VARCHAR(42) NOT NULL,           -- Agent 钱包
    
    -- AI 配置
    ai_provider VARCHAR(20) DEFAULT 'openai',    -- openai / anthropic / custom
    ai_api_key_encrypted TEXT,                   -- 用户的 API key（AES-256 加密）
    ai_model VARCHAR(50) DEFAULT 'gpt-4o-mini',  -- 模型选择
    
    -- 策略配置
    strategy VARCHAR(20) DEFAULT 'hodl',         -- hodl / buyback / distribute
    auto_notify BOOLEAN DEFAULT true,            -- 自动通知（不是 auto_claim）
    notify_threshold DECIMAL DEFAULT 0.1,        -- 通知阈值 (BNB)
    
    -- 社交配置（可选）
    telegram_bot_token_encrypted TEXT,           -- Telegram bot token（加密）
    telegram_chat_id VARCHAR(50),                -- Telegram chat ID
    
    -- 元数据
    owner_address VARCHAR(42) NOT NULL,          -- NFALite owner 地址
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Index for fast lookup
CREATE INDEX idx_agent_configs_nfa_id ON agent_configs(nfa_id);
CREATE INDEX idx_agent_configs_token ON agent_configs(token_address);
CREATE INDEX idx_agent_configs_owner ON agent_configs(owner_address);
CREATE INDEX idx_agent_configs_active ON agent_configs(is_active) WHERE is_active = true;

-- RLS Policy (Row Level Security)
ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role has full access" ON agent_configs
    FOR ALL USING (true);

-- Comment
COMMENT ON TABLE agent_configs IS 'Standard Agent configuration for NFALite holders';

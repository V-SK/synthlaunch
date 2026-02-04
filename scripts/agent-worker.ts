/**
 * Agent Worker — Standard Tier
 * 
 * Runs periodically to check vault balances and execute AI tasks
 * for Standard tier agents.
 * 
 * Usage: npx ts-node scripts/agent-worker.ts
 * Or: node --loader ts-node/esm scripts/agent-worker.ts
 * 
 * Environment:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_KEY
 * - ENCRYPTION_KEY
 */

import { createPublicClient, http, formatEther } from 'viem';
import { bsc } from 'viem/chains';
import crypto from 'crypto';

// Environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const BSC_RPC = 'https://bsc-dataseed.binance.org/';

// Minimal ABI for vault balance
const VAULT_ABI = [
  {
    inputs: [],
    name: 'pendingAgent',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface AgentConfig {
  id: number;
  nfa_id: number;
  token_address: string;
  vault_address: string;
  agent_wallet: string;
  owner_address: string;
  ai_provider: string;
  ai_api_key_encrypted: string | null;
  ai_model: string;
  strategy: string;
  auto_notify: boolean;
  notify_threshold: number;
  telegram_bot_token_encrypted: string | null;
  telegram_chat_id: string | null;
  is_active: boolean;
}

// Decryption utility
function decrypt(encryptedData: string): string {
  const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
  const parts = encryptedData.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted data');
  
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// BSC client
const client = createPublicClient({
  chain: bsc,
  transport: http(BSC_RPC),
});

// Get vault balance
async function getVaultBalance(vaultAddress: string): Promise<bigint> {
  try {
    const balance = await client.readContract({
      address: vaultAddress as `0x${string}`,
      abi: VAULT_ABI,
      functionName: 'pendingAgent',
    });
    return balance;
  } catch {
    // Fallback to raw balance
    return await client.getBalance({ address: vaultAddress as `0x${string}` });
  }
}

// Send Telegram notification
async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    return response.ok;
  } catch (error) {
    console.error('Telegram notification failed:', error);
    return false;
  }
}

// Call AI API
async function callAI(
  provider: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string> {
  try {
    if (provider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 500,
        }),
      });
      
      if (!response.ok) throw new Error('OpenAI API error');
      
      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      
      if (!response.ok) throw new Error('Anthropic API error');
      
      const data = await response.json();
      return data.content[0]?.text || '';
    }
    
    return '';
  } catch (error) {
    console.error('AI call failed:', error);
    return '';
  }
}

// Process a single agent
async function processAgent(agent: AgentConfig): Promise<void> {
  console.log(`\nProcessing agent #${agent.nfa_id}...`);
  
  try {
    // 1. Check vault balance
    const balance = await getVaultBalance(agent.vault_address);
    const balanceBNB = parseFloat(formatEther(balance));
    console.log(`  Vault balance: ${balanceBNB.toFixed(4)} BNB`);
    
    // 2. Check if notification threshold met
    if (agent.auto_notify && balanceBNB >= agent.notify_threshold) {
      console.log(`  Balance above threshold (${agent.notify_threshold} BNB)`);
      
      // Prepare notification message
      let message = `🦞 <b>SynthLaunch Agent #${agent.nfa_id}</b>\n\n`;
      message += `Your vault has <b>${balanceBNB.toFixed(4)} BNB</b> ready to claim!\n\n`;
      message += `Strategy: ${agent.strategy.toUpperCase()}\n`;
      message += `Vault: <code>${agent.vault_address}</code>\n\n`;
      
      if (agent.strategy === 'buyback') {
        message += `💡 Consider using these funds for a token buyback.`;
      } else if (agent.strategy === 'distribute') {
        message += `💡 Consider distributing to token holders.`;
      } else {
        message += `💎 HODL strategy active. Funds accumulating.`;
      }
      
      // 3. If AI key available, generate AI insight
      if (agent.ai_api_key_encrypted) {
        try {
          const apiKey = decrypt(agent.ai_api_key_encrypted);
          const prompt = `You are an AI agent managing a crypto token vault. The vault has ${balanceBNB.toFixed(4)} BNB in tax revenue. Strategy is ${agent.strategy}. Give a brief (1-2 sentences) market-aware suggestion for the owner. Be concise and actionable.`;
          
          const aiResponse = await callAI(agent.ai_provider, apiKey, agent.ai_model, prompt);
          if (aiResponse) {
            message += `\n\n🤖 <i>${aiResponse}</i>`;
          }
        } catch (error) {
          console.error('  AI call failed:', error);
        }
      }
      
      // 4. Send Telegram notification
      if (agent.telegram_bot_token_encrypted && agent.telegram_chat_id) {
        try {
          const botToken = decrypt(agent.telegram_bot_token_encrypted);
          const sent = await sendTelegramNotification(botToken, agent.telegram_chat_id, message);
          console.log(`  Telegram notification: ${sent ? 'sent' : 'failed'}`);
        } catch (error) {
          console.error('  Telegram notification failed:', error);
        }
      }
    } else {
      console.log(`  Balance below threshold, skipping notification`);
    }
    
  } catch (error) {
    console.error(`  Error processing agent #${agent.nfa_id}:`, error);
  }
}

// Main worker function
async function runWorker(): Promise<void> {
  console.log('='.repeat(50));
  console.log(`Agent Worker started at ${new Date().toISOString()}`);
  console.log('='.repeat(50));
  
  // Fetch active agents from Supabase
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/agent_configs?is_active=eq.true&select=*`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    }
  );
  
  if (!response.ok) {
    console.error('Failed to fetch agents from Supabase');
    return;
  }
  
  const agents: AgentConfig[] = await response.json();
  console.log(`Found ${agents.length} active agents`);
  
  // Process each agent
  for (const agent of agents) {
    await processAgent(agent);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`Worker completed at ${new Date().toISOString()}`);
  console.log('='.repeat(50));
}

// Run
runWorker().catch(console.error);

# Eva 任务：SynthLaunch 网站优化

**优先级：高**
**权限：Codex 全权限（部署、GitHub、Supabase 都可以）**
**代码位置：`/Users/v/Desktop/synthlaunch`**

---

## 1. 导航栏重新分类

**现在：**
```
首页 | 发币 | 公平铸造 | 领取 | 排行榜 | 身份 | NFA
```

**改成：**
```
首页 | 🚀 发币 ▼ | 🤖 NFA | 💬 Chat | 排行榜 | 文档
```

**发币下拉菜单：**
- Flap 发币（跳转 flap.sh）
- 公平铸造
- 领取税收

**重点：NFA 要显眼，加图标或特殊样式**

---

## 2. 新增 Agent Chat 页面

**路径：** `/agent/[id]/chat`

**功能：**
1. 连接钱包
2. 从链上读取 token 地址（通过 NFALite 合约）
3. 验证用户持有该 Token（阈值从数据库读，默认 1000）
4. 持有者解锁聊天窗口
5. 调用 AI 用该 Agent 的人设回复

**UI：**
- 左侧：Agent 头像 + 名字 + 基本信息
- 右侧：聊天窗口（类似 ChatGPT 风格）
- 底部：输入框 + 发送按钮
- 未持币时显示：「持有 XXX 代币即可与 Agent 对话」

---

## 3. 新增 Agent 配置页面

**路径：** `/agent/[id]/settings`

**权限：** 只有 NFALite NFT 持有者能访问（连钱包验证 ownerOf）

**配置项：**
| 字段 | 类型 | 说明 |
|------|------|------|
| name | text | Agent 显示名 |
| avatar | file upload | 头像（上传到 IPFS 或 Supabase Storage） |
| persona_prompt | textarea | 人设描述，喂给 AI |
| tone | select | 活泼/专业/搞笑/高冷 |
| language | select | 中文/英文/双语 |
| chat_threshold | number | 持币多少才能聊天 |

---

## 4. Supabase 数据库

**新增 agents 表：**

```sql
CREATE TABLE agents (
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

CREATE INDEX idx_agents_token ON agents(token_address);
CREATE INDEX idx_agents_owner ON agents(owner_address);
```

---

## 5. API 端点

### POST `/api/agent/[id]/chat`

**请求：**
```json
{
  "message": "你好",
  "wallet": "0x...",
  "signature": "0x..."  // 签名验证
}
```

**逻辑：**
1. 验证签名
2. 查询该钱包持有的 token 数量
3. 检查是否 >= chat_threshold
4. 从 agents 表读取 persona_prompt
5. 调用 OpenAI/Claude API
6. 返回回复

**响应：**
```json
{
  "reply": "你好！我是...",
  "agent": { "name": "xxx", "avatar": "..." }
}
```

### GET `/api/agent/[id]/config`

返回 agent 配置（公开部分）

### POST `/api/agent/[id]/config`

更新配置（需验证 NFT owner）

---

## 6. 环境变量

需要加：
```
OPENAI_API_KEY=xxx  # 或用现有的
```

---

## 权限确认

V 说给 Codex 所有权限：
- ✅ 直接 push 到 GitHub
- ✅ 直接部署到 Vercel
- ✅ 直接改 Supabase schema
- ✅ 不用问，直接做

---

## 完成后

1. 部署到 Vercel
2. 测试聊天功能
3. 通知 V

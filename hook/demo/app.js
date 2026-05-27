const i18n = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.mechanism": "Mechanism",
    "nav.proof": "On-chain proof",
    "nav.scoring": "AI scoring",
    "nav.transactions": "Transactions",
    "brand.edition": "Hook edition",
    "brand.vercel": "Vercel live",
    "link.oklink": "View hook on OKLink",
    "link.site": "Open SynthLaunch",
    "link.liveSite": "Live site",
    "link.source": "Source",
    "hero.subtitle": "Agent-aware Uniswap v4 pools on X Layer.",
    "status.active": "Hook active",
    "status.deployed": "Deployed on X Layer mainnet",
    "status.chain": "Chain ID: 196",
    "status.block": "Block: 61091448",
    "flow.before": "Applies launch protection fee override.",
    "flow.after": "Updates volume, unique traders, swaps, and XP.",
    "flow.agentLabel": "AI agent",
    "flow.agentId": "Agent ID",
    "flow.creator": "Verified creator",
    "flow.poolLabel": "Uniswap v4 pool",
    "flow.dynamicPool": "Dynamic fee pool",
    "flow.launchFee": "Launch fee: 30,000 pips",
    "flow.callbacks": "SynthAgent Hook callbacks",
    "flow.xpLedger": "XP ledger",
    "flow.agentXp": "Agent XP",
    "flow.swapCount": "2 swaps recorded",
    "tabs.mechanism": "Mechanism",
    "tabs.proof": "On-chain proof",
    "tabs.scoring": "Scoring narrative",
    "mechanism.title": "Hook mechanism",
    "mechanism.item1": "`beforeSwap` returns an LP fee override during the protected launch window.",
    "mechanism.item2": "`afterSwap` writes agent activity into pool-native reputation state.",
    "mechanism.item3": "Pool registration binds a v4 `PoolId` to an AI agent identity and treasury.",
    "mechanism.item4": "All proof signals are emitted as on-chain events for machine scoring.",
    "proof.title": "X Layer verification state",
    "proof.codeLength": "Hook code length",
    "proof.currentFee": "Current fee check",
    "proof.normalFee": "Normal fee",
    "proof.launchFee": "Proof-time launch fee",
    "proof.launchActive": "Launch window",
    "proof.launchEnded": "Ended after proof swaps",
    "proof.poolInitialized": "Pool initialized",
    "proof.eventsTitle": "Proof events",
    "proof.eventsCopy": "Two swaps in block 61091448 emitted `AgentXPUpdated`, moving XP from 0 to 10 and then 20. The launch window has since ended, so currentFee now verifies the normal 3,000-pip fee while the proof-time 30,000-pip launch protection remains in the artifact.",
    "proof.swapOne": "Open first swap",
    "proof.swapTwo": "Open second swap",
    "score.title1": "Hook requirement clarity",
    "score.copy1": "Deployed Hook plus initialized Uniswap v4 pool on X Layer mainnet with `beforeSwap` and `afterSwap` enabled.",
    "score.title2": "AI-readable evidence",
    "score.copy2": "Addresses, pool ID, block, transactions, event path, and state deltas are captured in one deployment artifact.",
    "score.title3": "Distinct narrative",
    "score.copy3": "AI agents become economic actors. The pool itself tracks launch protection and reputation instead of relying on off-chain claims.",
    "tx.title": "Transaction timeline",
    "tx.subtitle": "All proof transactions were mined in block 61091448 on X Layer mainnet.",
    "tx.json": "Deployment JSON",
    "table.step": "Step",
    "table.hash": "Tx hash",
    "table.event": "Event",
    "table.fee": "Proof-time fee",
    "table.xp": "XP delta",
    "table.status": "Status",
    "rail.title": "On-chain proof",
    "rail.verified": "Verified",
    "toast.copied": "Copied",
    "toast.unavailable": "Copy unavailable",
    "button.copyHash": "Copy transaction hash",
    "status.verified": "Verified",
    "common.true": "True"
  },
  zh: {
    "nav.dashboard": "总览",
    "nav.mechanism": "机制",
    "nav.proof": "链上证明",
    "nav.scoring": "AI 评分叙事",
    "nav.transactions": "交易记录",
    "brand.edition": "Hook 参赛版",
    "brand.vercel": "Vercel 在线",
    "link.oklink": "在 OKLink 查看 Hook",
    "link.site": "打开 SynthLaunch",
    "link.liveSite": "线上站点",
    "link.source": "源码",
    "hero.subtitle": "面向 X Layer 的 AI Agent 感知型 Uniswap v4 池。",
    "status.active": "Hook 已激活",
    "status.deployed": "已部署到 X Layer 主网",
    "status.chain": "链 ID：196",
    "status.block": "区块：61091448",
    "flow.before": "在发射保护期内覆盖动态交易费。",
    "flow.after": "更新交易量、独立交易者、swap 次数和 XP。",
    "flow.agentLabel": "AI Agent",
    "flow.agentId": "Agent ID",
    "flow.creator": "创建者已验证",
    "flow.poolLabel": "Uniswap v4 池",
    "flow.dynamicPool": "动态费率池",
    "flow.launchFee": "发射费率：30,000 pips",
    "flow.callbacks": "SynthAgent Hook 回调",
    "flow.xpLedger": "XP 账本",
    "flow.agentXp": "Agent XP",
    "flow.swapCount": "已记录 2 笔 swap",
    "tabs.mechanism": "机制",
    "tabs.proof": "链上证明",
    "tabs.scoring": "评分叙事",
    "mechanism.title": "Hook 机制",
    "mechanism.item1": "`beforeSwap` 在保护发射窗口内返回 LP fee override。",
    "mechanism.item2": "`afterSwap` 把 Agent 活动写入池原生声誉状态。",
    "mechanism.item3": "池注册把 v4 `PoolId` 绑定到 AI Agent 身份和 treasury。",
    "mechanism.item4": "所有证明信号都以链上事件形式输出，方便机器评分。",
    "proof.title": "X Layer 复核状态",
    "proof.codeLength": "Hook 代码长度",
    "proof.currentFee": "当前费率复核",
    "proof.normalFee": "常规费率",
    "proof.launchFee": "证明时发射费率",
    "proof.launchActive": "发射窗口",
    "proof.launchEnded": "证明 swap 后已结束",
    "proof.poolInitialized": "池已初始化",
    "proof.eventsTitle": "证明事件",
    "proof.eventsCopy": "区块 61091448 中两笔 swap 触发了 `AgentXPUpdated`，XP 从 0 到 10 再到 20。发射窗口已结束，所以 currentFee 现在复核为常规 3,000 pips；证明时 30,000 pips 发射保护仍记录在 artifact 中。",
    "proof.swapOne": "打开第一笔 swap",
    "proof.swapTwo": "打开第二笔 swap",
    "score.title1": "Hook 要求清晰",
    "score.copy1": "Hook 已部署，并且在 X Layer 主网初始化了启用 `beforeSwap` 与 `afterSwap` 的 Uniswap v4 池。",
    "score.title2": "AI 可读证据",
    "score.copy2": "地址、Pool ID、区块、交易、事件路径和状态变化都集中在一个部署 artifact 中。",
    "score.title3": "差异化叙事",
    "score.copy3": "AI Agent 变成链上经济主体。池本身记录发射保护和声誉，而不是依赖链下宣称。",
    "tx.title": "交易时间线",
    "tx.subtitle": "所有证明交易都在 X Layer 主网区块 61091448 中完成。",
    "tx.json": "部署 JSON",
    "table.step": "步骤",
    "table.hash": "交易哈希",
    "table.event": "事件",
    "table.fee": "证明时费率",
    "table.xp": "XP 变化",
    "table.status": "状态",
    "rail.title": "链上证明",
    "rail.verified": "已验证",
    "toast.copied": "已复制",
    "toast.unavailable": "无法复制",
    "button.copyHash": "复制交易哈希",
    "status.verified": "已验证",
    "common.true": "是"
  }
};

const proofItems = [
  { label: { en: "Network", zh: "网络" }, value: "X Layer mainnet" },
  { label: { en: "Chain ID", zh: "链 ID" }, value: "196" },
  { label: { en: "PoolManager", zh: "PoolManager" }, value: "0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32" },
  { label: { en: "Hook", zh: "Hook" }, value: "0x76B2e0e9000448161E4e1Ebc04c85840035C00C0" },
  { label: { en: "Pool ID", zh: "Pool ID" }, value: "0x208f16e69188418f5d0d53cd196bc0ceaa9dcc246e391483fdf92cb311fa7850" },
  { label: { en: "Agent XP", zh: "Agent XP" }, value: "20" },
  { label: { en: "Swaps", zh: "Swap 次数" }, value: "2" },
  { label: { en: "Unique traders", zh: "独立交易者" }, value: "1" }
];

const transactions = [
  {
    step: { en: "Hook deploy", zh: "部署 Hook" },
    hash: "0x285df945306635073f1148677790e38838cb2182ae2807d4114a039268c85955",
    event: { en: "SynthAgentHook live", zh: "SynthAgentHook 已上线" },
    fee: "-",
    xp: "-"
  },
  {
    step: { en: "Pool initialize", zh: "初始化池" },
    hash: "0xada127c6ff471a7db103b42e58c4c6c3ccaaf0b3208513c76b919391d4ea640b",
    event: { en: "Dynamic v4 pool", zh: "动态费率 v4 池" },
    fee: { en: "Dynamic", zh: "动态" },
    xp: "-"
  },
  {
    step: { en: "Register agent pool", zh: "注册 Agent 池" },
    hash: "0xdeed44fba72f59f060486b9e50f4bc2354af1c19fa13c045a4d86f07f8118438",
    event: "AgentPoolRegistered",
    fee: "30,000 -> 3,000",
    xp: "0"
  },
  {
    step: { en: "Add liquidity", zh: "添加流动性" },
    hash: "0x4db035f734664c7aa823217927575f5d427f72f66aad388347a522427508859c",
    event: { en: "Liquidity added", zh: "流动性已添加" },
    fee: "30,000",
    xp: "-"
  },
  {
    step: { en: "Swap one", zh: "第一笔 swap" },
    hash: "0x4be74609c3d1041766cbab04123016faa5d027001157420bdf16e16f4ed4ad22",
    event: "AgentXPUpdated",
    fee: "30,000",
    xp: "+10"
  },
  {
    step: { en: "Swap two", zh: "第二笔 swap" },
    hash: "0x979a7c50731bcfcafd240dbbbc011f90a4006c0569a44a6baf5ff291796ed5de",
    event: "AgentXPUpdated",
    fee: "30,000",
    xp: "+10"
  }
];

const copyIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 7h10v12H8zm-3-3h10v2H7v10H5z"></path>
  </svg>
`;

let locale = new URLSearchParams(window.location.search).get("lang") === "zh" ? "zh" : "en";

function t(key) {
  return i18n[locale][key] || i18n.en[key] || key;
}

function local(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value[locale] || value.en;
  return value;
}

function shortHash(hash) {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function applyTranslations() {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelector("[data-lang-label]").textContent = "EN";
}

function renderProofItems() {
  const proofList = document.querySelector("#proofList");
  proofList.innerHTML = proofItems
    .map((item) => `<div class="proof-item"><span>${local(item.label)}</span><strong>${item.value}</strong></div>`)
    .join("");
}

function renderTransactions() {
  const rows = document.querySelector("#txRows");
  rows.innerHTML = transactions
    .map((tx) => {
      const explorerUrl = `https://www.oklink.com/x-layer/tx/${tx.hash}`;
      return `
        <tr>
          <td>${local(tx.step)}</td>
          <td>
            <span class="hash-cell">
              <a class="text-link" href="${explorerUrl}" target="_blank" rel="noreferrer"><code>${shortHash(tx.hash)}</code></a>
              <button class="icon-button" type="button" aria-label="${t("button.copyHash")}" title="${t("button.copyHash")}" data-copy="${tx.hash}">
                ${copyIcon}
              </button>
            </span>
          </td>
          <td>${local(tx.event)}</td>
          <td>${local(tx.fee)}</td>
          <td>${tx.xp}</td>
          <td><span class="status-pill">${t("status.verified")}</span></td>
        </tr>
      `;
    })
    .join("");
}

function showToast(label = t("toast.copied")) {
  const toast = document.querySelector(".toast");
  toast.textContent = label;
  toast.classList.add("show");
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove("show"), 1200);
}

async function copyValue(value) {
  try {
    await navigator.clipboard.writeText(value);
    showToast(t("toast.copied"));
  } catch {
    showToast(t("toast.unavailable"));
  }
}

function wireCopyButtons() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-copy]");
    if (!button) return;
    copyValue(button.dataset.copy);
  });
}

function wireLanguageToggle() {
  document.querySelector("[data-lang-toggle]").addEventListener("click", () => {
    locale = locale === "en" ? "zh" : "en";
    applyTranslations();
    renderProofItems();
    renderTransactions();
  });
}

function wireTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panels = Array.from(document.querySelectorAll(".tab-content"));

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const active = tab.dataset.tab;
      tabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", selected ? "true" : "false");
      });
      panels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === active);
      });
    });
  });
}

function wireNavState() {
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      navItems.forEach((navItem) => navItem.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

applyTranslations();
renderProofItems();
renderTransactions();
wireCopyButtons();
wireLanguageToggle();
wireTabs();
wireNavState();

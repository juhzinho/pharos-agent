"use client";

// Complete user guide — bilingual (PT-BR / EN), with real product screenshots,
// step-by-step instructions, example prompts and security warnings.

import { useState } from "react";
import PageShell from "@/components/PageShell";

type Lang = "pt" | "en";

interface Section {
  id: string;
  icon: string;
  title: Record<Lang, string>;
  intro?: Record<Lang, string>;
  steps?: Record<Lang, string[]>;      // numbered how-to steps
  bullets?: Record<Lang, string[]>;    // feature bullets
  examples?: Record<Lang, string[]>;   // things to type in the chat
  warning?: Record<Lang, string>;
  image?: { src: string; alt: string };
}

const SECTIONS: Section[] = [
  {
    id: "intro",
    icon: "🤖",
    title: { pt: "O que é o Pharos Agent", en: "What is Pharos Agent" },
    intro: {
      pt: "O Pharos Agent é um copiloto DeFi com IA para a Pharos Network (Chain ID 1672). Você conversa em linguagem natural — em qualquer um de 30 idiomas — e ele executa ações on-chain (swap, bridge, liquidez, envios), analisa carteiras, explica transações e responde qualquer pergunta sobre a Pharos e o mundo cripto. Ele é 100% não-custodial: nunca toca nas suas chaves — toda transação é assinada por VOCÊ, na SUA carteira.",
      en: "Pharos Agent is an AI DeFi copilot for the Pharos Network (Chain ID 1672). You chat in natural language — in any of 30 languages — and it executes on-chain actions (swap, bridge, liquidity, transfers), analyzes wallets, explains transactions and answers any question about Pharos and the crypto world. It is 100% non-custodial: it never touches your keys — every transaction is signed by YOU, in YOUR wallet.",
    },
    bullets: {
      pt: [
        "Swap e bridge com comparação de rotas e melhor retorno destacado",
        "Liquidez concentrada na FaroSwap V3 (adicionar, remover, coletar taxas)",
        "Pagamentos: envie PROS e tokens por comando de voz escrita, inclusive em lote",
        "Inteligência de carteira: score, volumes, posições RealFi, análise completa",
        "Conhecimento profundo: Pharos, DeFi, RWA, staking, NFTs, segurança e muito mais",
        "Dados ao vivo: preço do $PROS, notícias, tweets, campanhas e métricas da rede",
      ],
      en: [
        "Swap and bridge with route comparison and the best return highlighted",
        "Concentrated liquidity on FaroSwap V3 (add, remove, collect fees)",
        "Payments: send PROS and tokens by typed command, including batch sends",
        "Wallet intelligence: score, volumes, RealFi positions, full analysis",
        "Deep knowledge: Pharos, DeFi, RWA, staking, NFTs, security and much more",
        "Live data: $PROS price, news, tweets, campaigns and network metrics",
      ],
    },
    image: { src: "/guide/chat-welcome.png", alt: "Pharos Agent chat" },
  },
  {
    id: "connect",
    icon: "🔗",
    title: { pt: "Como conectar sua carteira", en: "How to connect your wallet" },
    steps: {
      pt: [
        "Instale uma carteira compatível com EVM: MetaMask, OKX Wallet, Rabby, Bitget Wallet ou similar (extensão do navegador).",
        "Abra o site e clique em \"Connect\" no canto superior direito.",
        "Se você tiver mais de uma carteira instalada, um seletor aparece — escolha a que quiser usar.",
        "Aprove a conexão na janela da carteira.",
        "Se a rede Pharos ainda não estiver na sua carteira, o site pede para adicioná-la automaticamente (Chain ID 1672, RPC rpc.pharos.xyz, símbolo PROS). É só aprovar.",
        "Pronto — seu endereço e saldo aparecem no topo. A conexão persiste entre visitas até você desconectar.",
      ],
      en: [
        "Install an EVM-compatible wallet: MetaMask, OKX Wallet, Rabby, Bitget Wallet or similar (browser extension).",
        "Open the site and click \"Connect\" in the top-right corner.",
        "If you have more than one wallet installed, a picker appears — choose the one you want.",
        "Approve the connection in the wallet popup.",
        "If the Pharos network isn't in your wallet yet, the site asks to add it automatically (Chain ID 1672, RPC rpc.pharos.xyz, symbol PROS). Just approve.",
        "Done — your address and balance appear at the top. The connection persists across visits until you disconnect.",
      ],
    },
    warning: {
      pt: "O site NUNCA pede sua seed phrase ou chave privada. Se algo pedir, é golpe — feche imediatamente.",
      en: "The site NEVER asks for your seed phrase or private key. If anything asks, it's a scam — close it immediately.",
    },
  },
  {
    id: "networks",
    icon: "🌐",
    title: { pt: "Redes: Mainnet × Atlantic Testnet", en: "Networks: Mainnet × Atlantic Testnet" },
    intro: {
      pt: "No canto do site há um seletor de rede. Ao trocar, todo o app acompanha (saldo, símbolo do token, explorer) e o agente avisa no chat o que funciona na rede escolhida.",
      en: "There's a network switcher in the corner of the site. When you switch, the whole app follows (balance, token symbol, explorer) and the agent announces in the chat what works on the selected network.",
    },
    bullets: {
      pt: [
        "Pharos Mainnet (Chain ID 1672, token PROS): TUDO funciona — swap, bridge, liquidez, envios, análises.",
        "Atlantic Testnet (Chain ID 688689, token PHRS): envios de PHRS, análise de carteira e explicador de tx. Swap/bridge/liquidez ficam desativados (os contratos só existem na mainnet).",
        "Faucet de PHRS grátis: testnet.pharosnetwork.xyz e stakely.io/faucet/pharos-atlantic-testnet-phrs",
      ],
      en: [
        "Pharos Mainnet (Chain ID 1672, PROS token): EVERYTHING works — swap, bridge, liquidity, transfers, analytics.",
        "Atlantic Testnet (Chain ID 688689, PHRS token): PHRS transfers, wallet analysis and tx explainer. Swap/bridge/liquidity are disabled (contracts only exist on mainnet).",
        "Free PHRS faucet: testnet.pharosnetwork.xyz and stakely.io/faucet/pharos-atlantic-testnet-phrs",
      ],
    },
  },
  {
    id: "chat",
    icon: "💬",
    title: { pt: "Conversando com o agente", en: "Talking to the agent" },
    intro: {
      pt: "Escreva como você falaria com uma pessoa. O agente detecta o idioma automaticamente e responde no mesmo — português, inglês, espanhol, chinês, japonês, árabe… 30 idiomas. Ele lembra o contexto da conversa, então você pode fazer perguntas de acompanhamento.",
      en: "Write like you'd talk to a person. The agent detects the language automatically and replies in the same one — Portuguese, English, Spanish, Chinese, Japanese, Arabic… 30 languages. It remembers the conversation context, so follow-up questions work.",
    },
    examples: {
      pt: [
        "explique a arquitetura da Pharos Network",
        "o que é impermanent loss?",
        "qual a diferença entre APR e APY?",
        "quais protocolos RWA existem na Pharos?",
        "qual o preço do PROS agora?",
        "quais campanhas estão ativas?",
        "me mostra as últimas notícias da Pharos",
        "o que é um perp DEX e como funciona o funding rate?",
      ],
      en: [
        "explain the Pharos Network architecture",
        "what is impermanent loss?",
        "what's the difference between APR and APY?",
        "which RWA protocols exist on Pharos?",
        "what's the PROS price right now?",
        "which campaigns are active?",
        "show me the latest Pharos news",
        "what is a perp DEX and how does the funding rate work?",
      ],
    },
    image: { src: "/guide/chat-question.png", alt: "Asking the agent a question" },
  },
  {
    id: "swap",
    icon: "⇄",
    title: { pt: "Swap de tokens", en: "Swapping tokens" },
    intro: {
      pt: "Peça um swap e o assistente guiado abre: escolha o token de origem (com seus saldos ao vivo), o valor (digite ou use 25/50/75/100%), o token de destino — e ele compara as rotas (FaroSwap e LI.FI), destacando o melhor retorno. Você confirma e assina na carteira.",
      en: "Ask for a swap and the guided wizard opens: pick the source token (with your live balances), the amount (type it or use 25/50/75/100%), the destination token — and it compares routes (FaroSwap and LI.FI), highlighting the best return. You confirm and sign in your wallet.",
    },
    examples: {
      pt: ["troca 5 PROS por USDC", "swap 10 USDC para WETH", "quero fazer um swap"],
      en: ["swap 5 PROS for USDC", "swap 10 USDC to WETH", "I want to make a swap"],
    },
  },
  {
    id: "bridge",
    icon: "🌉",
    title: { pt: "Bridge cross-chain", en: "Cross-chain bridge" },
    intro: {
      pt: "Envie tokens entre a Pharos e Ethereum, Base, Arbitrum ou Polygon. O assistente mostra seus saldos, pergunta o valor e a chain de destino, e compara os provedores disponíveis (LI.FI/Jumper, Chainlink CCIP, Circle CCTP v2 para USDC) com o retorno estimado de cada um — o melhor vem marcado.",
      en: "Send tokens between Pharos and Ethereum, Base, Arbitrum or Polygon. The wizard shows your balances, asks for the amount and destination chain, and compares available providers (LI.FI/Jumper, Chainlink CCIP, Circle CCTP v2 for USDC) with each estimated return — the best one is marked.",
    },
    examples: {
      pt: ["faz bridge de 20 USDC para a Base", "manda 0.1 WETH para o Arbitrum", "quero fazer uma bridge"],
      en: ["bridge 20 USDC to Base", "send 0.1 WETH to Arbitrum", "I want to bridge"],
    },
  },
  {
    id: "liquidity",
    icon: "💧",
    title: { pt: "Liquidez na FaroSwap V3", en: "Liquidity on FaroSwap V3" },
    intro: {
      pt: "Adicione liquidez concentrada no par WPROS/USDC: o assistente pergunta o fee tier (0.01% a 1%), a faixa de preço (±5%, ±10%, ±20%, faixa completa ou um % personalizado que você digita) e o valor — mostrando quanto de USDC corresponde ao WPROS informado, pelo preço real da pool. Suas posições viram NFTs que você acompanha e gerencia pelo chat: remover (25/50/75/100%) e coletar taxas.",
      en: "Add concentrated liquidity to the WPROS/USDC pair: the wizard asks for the fee tier (0.01% to 1%), the price range (±5%, ±10%, ±20%, full range or a custom % you type) and the amount — showing how much USDC corresponds to the WPROS you entered, at the live pool price. Your positions become NFTs you can track and manage from the chat: remove (25/50/75/100%) and collect fees.",
    },
    examples: {
      pt: ["adicionar liquidez", "mostra minhas posições LP", "remove 50% da posição", "coleta as taxas da minha pool"],
      en: ["add liquidity", "show my LP positions", "remove 50% of the position", "collect my pool fees"],
    },
  },
  {
    id: "pay",
    icon: "💸",
    title: { pt: "Enviar tokens (pagamentos)", en: "Sending tokens (payments)" },
    intro: {
      pt: "Envie PROS ou tokens ERC-20 para qualquer endereço, por linguagem natural. Se você não disser o valor, o agente pergunta quanto — mostrando seu saldo com botões de porcentagem. Envios em lote funcionam num único comando. Na testnet, envie PHRS do mesmo jeito.",
      en: "Send PROS or ERC-20 tokens to any address using natural language. If you don't say the amount, the agent asks how much — showing your balance with percentage buttons. Batch sends work in a single command. On testnet, send PHRS the same way.",
    },
    examples: {
      pt: [
        "envie 2 PROS para 0xAbC…",
        "envie pros para 0xAbC… (ele pergunta quanto)",
        "manda 1 PROS pro 0xAAA… e 2 PROS pro 0xBBB…",
        "airdrop de 0.1 PROS para 0xA…, 0xB…, 0xC…",
      ],
      en: [
        "send 2 PROS to 0xAbC…",
        "send pros to 0xAbC… (it asks how much)",
        "send 1 PROS to 0xAAA… and 2 PROS to 0xBBB…",
        "airdrop 0.1 PROS to 0xA…, 0xB…, 0xC…",
      ],
    },
    warning: {
      pt: "Confira SEMPRE o endereço e o valor na janela da carteira antes de assinar. Transações em blockchain são irreversíveis.",
      en: "ALWAYS check the address and amount in the wallet popup before signing. Blockchain transactions are irreversible.",
    },
    image: { src: "/guide/chat-payment.png", alt: "Payment card" },
  },
  {
    id: "approve",
    icon: "✅",
    title: { pt: "Aprovações ERC-20", en: "ERC-20 approvals" },
    intro: {
      pt: "Autorize contratos a gastar seus tokens por comando: o agente monta a transação de approve e você assina. Prefira sempre aprovar o valor exato em vez de ilimitado.",
      en: "Authorize contracts to spend your tokens by command: the agent builds the approve transaction and you sign. Always prefer approving the exact amount instead of unlimited.",
    },
    examples: {
      pt: ["aprova 100 USDC para 0xContrato…", "dá allowance ilimitada de USDC pro 0x… (com aviso de risco)"],
      en: ["approve 100 USDC for 0xContract…", "give unlimited USDC allowance to 0x… (with a risk warning)"],
    },
    warning: {
      pt: "Aprovação ilimitada = se o contrato for comprometido, ele pode drenar TODO o seu saldo daquele token. Use só com protocolos que você confia, e revogue allowances antigas periodicamente.",
      en: "Unlimited approval = if the contract is compromised, it can drain ALL your balance of that token. Use only with protocols you trust, and revoke old allowances periodically.",
    },
  },
  {
    id: "intel",
    icon: "🧠",
    title: { pt: "Inteligência de carteira", en: "Wallet intelligence" },
    intro: {
      pt: "O agente analisa qualquer endereço da Pharos — o seu ou de terceiros. No chat ou na página dedicada Wallet (menu superior), você vê: score 0-100 em 6 categorias, todos os tokens em posse com saldos ao vivo, volume movimentado por token (entrada/saída), tipos de movimentação (swaps, bridges, liquidez, transferências), gás gasto, timeline mensal e protocolos usados.",
      en: "The agent analyzes any Pharos address — yours or anyone's. In the chat or on the dedicated Wallet page (top menu), you see: 0-100 score across 6 categories, every token held with live balances, volume moved per token (in/out), movement types (swaps, bridges, liquidity, transfers), gas spent, monthly timeline and protocols used.",
    },
    examples: {
      pt: [
        "qual o score da minha carteira?",
        "analisa a carteira 0xAbC…",
        "minhas posições RealFi",
        "compara as carteiras 0xAAA… e 0xBBB…",
      ],
      en: [
        "what's my wallet score?",
        "analyze wallet 0xAbC…",
        "my RealFi positions",
        "compare wallets 0xAAA… and 0xBBB…",
      ],
    },
  },
  {
    id: "explain",
    icon: "🔎",
    title: { pt: "Explicador de transações", en: "Transaction explainer" },
    intro: {
      pt: "Cole qualquer hash de transação (0x + 64 caracteres) e o agente traduz para linguagem simples: o que a transação fez, valores, contratos envolvidos, status — e, se falhou, o motivo exato do revert decodificado. Funciona na mainnet e na testnet.",
      en: "Paste any transaction hash (0x + 64 characters) and the agent translates it to plain language: what the transaction did, amounts, contracts involved, status — and, if it failed, the exact decoded revert reason. Works on mainnet and testnet.",
    },
    examples: {
      pt: ["0x5a5a2f… (só colar o hash)", "explica essa transação: 0x…", "por que essa tx falhou? 0x…"],
      en: ["0x5a5a2f… (just paste the hash)", "explain this transaction: 0x…", "why did this tx fail? 0x…"],
    },
  },
  {
    id: "pages",
    icon: "🗂️",
    title: { pt: "Páginas do site", en: "Site pages" },
    bullets: {
      pt: [
        "Chat — o coração do agente: todas as ações e perguntas.",
        "Wallet — dashboard completo de análise de carteira (qualquer endereço).",
        "Ecosystem — diretório dos 40+ dApps da Pharos, com filtro e busca.",
        "Trade — preço do $PROS ao vivo, gráfico interativo, market cap e onde negociar (CEX/DEX).",
        "Campaigns — campanhas de recompensas ativas do Pharos Port, com prazos.",
        "News — notícias, blogs e tweets oficiais em uma timeline ao vivo (com arquivo permanente: nada some).",
        "Network — saúde da rede em tempo real + 14 gráficos de métricas (transações, endereços, TVL, RWA).",
      ],
      en: [
        "Chat — the heart of the agent: every action and question.",
        "Wallet — full wallet-analysis dashboard (any address).",
        "Ecosystem — directory of 40+ Pharos dApps, filterable and searchable.",
        "Trade — live $PROS price, interactive chart, market cap and trading venues (CEX/DEX).",
        "Campaigns — active reward campaigns from Pharos Port, with deadlines.",
        "News — official news, blogs and tweets in one live timeline (with a permanent archive: nothing disappears).",
        "Network — real-time network health + 14 metric charts (transactions, addresses, TVL, RWA).",
      ],
    },
  },
  {
    id: "api",
    icon: "🛠️",
    title: { pt: "Skill APIs públicas (para devs)", en: "Public Skill APIs (for devs)" },
    intro: {
      pt: "Três endpoints públicos, somente leitura e com rate limit, prontos para outros agentes e integrações (Anvita Flow):",
      en: "Three public, read-only, rate-limited endpoints, ready for other agents and integrations (Anvita Flow):",
    },
    bullets: {
      pt: [
        "POST /api/skill/wallet-profile — { address } → saldo, nº de txs e perfil com IA",
        "POST /api/skill/wallet-score — { address } → score 0-100, categorias, volumes, holdings e flags",
        "POST /api/skill/explain-tx — { hash, network? } → explicação da transação em linguagem simples",
      ],
      en: [
        "POST /api/skill/wallet-profile — { address } → balance, tx count and AI profile",
        "POST /api/skill/wallet-score — { address } → 0-100 score, categories, volumes, holdings and flags",
        "POST /api/skill/explain-tx — { hash, network? } → plain-language transaction explanation",
      ],
    },
  },
  {
    id: "security",
    icon: "🛡️",
    title: { pt: "Segurança — leia antes de usar", en: "Security — read before using" },
    bullets: {
      pt: [
        "Não-custodial: o agente NUNCA tem acesso às suas chaves ou fundos. Ele apenas PROPÕE transações — quem assina é você, na sua carteira.",
        "Nunca compartilhe sua seed phrase ou chave privada com ninguém — nem com o agente, nem com \"suporte\". Suporte real nunca chama no privado.",
        "Confira endereço, valor e contrato na janela da carteira ANTES de assinar. O que a carteira mostra é o que vale.",
        "Prefira aprovações de valor exato; revogue allowances antigas (ex.: revoke.cash).",
        "Use os links oficiais: pharos.xyz, port.pharos.xyz, docs.pharos.xyz. Desconfie de sites parecidos e de \"airdrops\" pedindo assinatura.",
        "Comece com valores pequenos ao testar qualquer fluxo novo.",
        "As respostas do agente são informativas — não são aconselhamento financeiro. Rendimentos passados não garantem retornos futuros.",
      ],
      en: [
        "Non-custodial: the agent NEVER has access to your keys or funds. It only PROPOSES transactions — you sign them, in your wallet.",
        "Never share your seed phrase or private key with anyone — not the agent, not \"support\". Real support never DMs first.",
        "Check address, amount and contract in the wallet popup BEFORE signing. What the wallet shows is what counts.",
        "Prefer exact-amount approvals; revoke old allowances (e.g. revoke.cash).",
        "Use official links: pharos.xyz, port.pharos.xyz, docs.pharos.xyz. Beware of lookalike sites and \"airdrops\" asking for signatures.",
        "Start with small amounts when testing any new flow.",
        "The agent's answers are informational — not financial advice. Past yields don't guarantee future returns.",
      ],
    },
  },
  {
    id: "tips",
    icon: "💡",
    title: { pt: "Dicas rápidas", en: "Quick tips" },
    bullets: {
      pt: [
        "Digite \"cancelar\" a qualquer momento para abortar um fluxo em andamento.",
        "Use os botões de Quick Actions na barra lateral para ir direto ao ponto (swap, bridge, posições, score…).",
        "\"↺ New chat\" reinicia a conversa; \"⌂ Home\" volta para a página inicial.",
        "O agente entende gírias e erros de digitação — escreva naturalmente.",
        "Perguntas sobre preços, notícias e campanhas usam dados ao vivo — pode confiar na data.",
        "Ficou sem resposta? Reformule ou peça \"busca na web sobre X\" — ele pesquisa em tempo real.",
      ],
      en: [
        "Type \"cancel\" at any time to abort an ongoing flow.",
        "Use the Quick Actions in the sidebar to jump straight to swap, bridge, positions, score…",
        "\"↺ New chat\" restarts the conversation; \"⌂ Home\" goes back to the landing page.",
        "The agent understands slang and typos — write naturally.",
        "Price, news and campaign questions use live data — you can trust the freshness.",
        "No answer? Rephrase, or ask \"web search about X\" — it searches in real time.",
      ],
    },
  },
];

const UI = {
  pt: {
    eyebrow: "Guia do Usuário",
    title: "Como usar o Pharos Agent",
    subtitle: "Tudo o que o agente faz, como pedir, como conectar sua carteira e os avisos de segurança — passo a passo, com imagens reais.",
    toc: "Índice",
    examplesLabel: "Experimente digitar:",
    stepsLabel: "Passo a passo",
    warningLabel: "Atenção",
  },
  en: {
    eyebrow: "User Guide",
    title: "How to use Pharos Agent",
    subtitle: "Everything the agent does, how to ask, how to connect your wallet and the security warnings — step by step, with real screenshots.",
    toc: "Contents",
    examplesLabel: "Try typing:",
    stepsLabel: "Step by step",
    warningLabel: "Warning",
  },
} as const;

export default function GuidePage() {
  const [lang, setLang] = useState<Lang>("pt");
  const t = UI[lang];

  return (
    <PageShell eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} accent="#22d3ee" wide>
      {/* Language toggle */}
      <div className="flex items-center gap-2 mb-8">
        {([["pt", "🇧🇷 Português"], ["en", "🇺🇸 English"]] as Array<[Lang, string]>).map(([id, label]) => (
          <button key={id} onClick={() => setLang(id)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
            style={lang === id
              ? { background: "rgba(34,211,238,0.12)", borderColor: "rgba(34,211,238,0.45)", color: "#67e8f9" }
              : { borderColor: "rgba(255,255,255,0.08)", color: "rgba(148,163,184,0.7)" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Table of contents */}
      <div className="rounded-2xl border p-5 mb-10"
        style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(10,18,38,0.55)" }}>
        <h3 className="text-xs uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: "rgba(148,163,184,0.6)" }}>
          {t.toc}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
          {SECTIONS.map((s, i) => (
            <a key={s.id} href={`#${s.id}`}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:text-cyan-300"
              style={{ color: "rgba(203,213,225,0.75)" }}>
              <span className="opacity-70">{s.icon}</span>
              <span className="font-medium">{i + 1}. {s.title[lang]}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-10">
        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} className="rounded-2xl border p-6 scroll-mt-24"
            style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(10,18,38,0.45)" }}>
            <h2 className="flex items-center gap-3 text-lg font-extrabold mb-4 tracking-tight" style={{ color: "#f1f5f9" }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)" }}>
                {s.icon}
              </span>
              <span><span style={{ color: "rgba(34,211,238,0.6)" }}>{i + 1}.</span> {s.title[lang]}</span>
            </h2>

            {s.intro && (
              <p className="text-sm leading-[1.85] mb-4" style={{ color: "rgba(215,228,245,0.85)" }}>
                {s.intro[lang]}
              </p>
            )}

            {s.steps && (
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(52,211,153,0.6)" }}>
                  {t.stepsLabel}
                </p>
                <ol className="space-y-2">
                  {s.steps[lang].map((step, n) => (
                    <li key={n} className="flex gap-3 text-sm leading-relaxed" style={{ color: "rgba(215,228,245,0.85)" }}>
                      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5"
                        style={{ background: "rgba(52,211,153,0.12)", color: "#6ee7b7", border: "1px solid rgba(52,211,153,0.25)" }}>
                        {n + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {s.bullets && (
              <ul className="space-y-1.5 mb-4">
                {s.bullets[lang].map((b, n) => (
                  <li key={n} className="flex gap-2.5 text-sm leading-relaxed" style={{ color: "rgba(215,228,245,0.85)" }}>
                    <span className="shrink-0 mt-1" style={{ color: "rgba(34,211,238,0.7)" }}>▸</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {s.examples && (
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.12em] font-semibold mb-2.5" style={{ color: "rgba(34,211,238,0.6)" }}>
                  {t.examplesLabel}
                </p>
                <div className="flex flex-wrap gap-2">
                  {s.examples[lang].map((ex, n) => (
                    <code key={n} className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(8,15,32,0.8)", border: "1px solid rgba(34,211,238,0.15)", color: "#a5f3fc" }}>
                      {ex}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {s.warning && (
              <div className="flex gap-2.5 rounded-xl border px-4 py-3 mb-4 text-sm leading-relaxed"
                style={{ borderColor: "rgba(251,191,36,0.28)", background: "rgba(251,191,36,0.06)", color: "#fde68a" }}>
                <span className="shrink-0">⚠️</span>
                <span><strong className="font-bold">{t.warningLabel}:</strong> {s.warning[lang]}</span>
              </div>
            )}

            {s.image && (
              <div className="rounded-xl overflow-hidden border mt-2"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.image.src} alt={s.image.alt} className="w-full h-auto" loading="lazy" />
              </div>
            )}
          </section>
        ))}
      </div>
    </PageShell>
  );
}

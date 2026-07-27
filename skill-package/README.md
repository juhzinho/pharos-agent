# Pacote Skill — ProsPilot v3.0-security (Anvita Flow)

## Upload agora

| Arquivo | Uso |
|---------|-----|
| **`prospilot.zip`** | Upload no Console (pasta `prospilot/` + `SKILL.md`) |
| **`anvita-strategy-complete.txt`** | Colar em Customer Service Strategy |
| **`interaction-guide.txt`** | Colar no Interaction Guide / Agent Card |
| **`prospilot/references/COMPARATIVE.md`** | Comparativo marketplace (ler / anexar docs) |

Console: https://flow.anvita.xyz/service-agents  
Docs: https://docs.pharos.xyz/tooling-and-infrastructure/overview/publish-skill-af

## Regras do ZIP

1. `SKILL.md` em **MAIÚSCULAS**
2. Frontmatter `name: prospilot` = pasta `prospilot/`
3. Regenerar com `.\skill-package\pack.ps1` (não use Compress-Archive)

## Conteúdo do pacote

```
prospilot.zip
└── prospilot/
    ├── SKILL.md
    ├── assets/        (tokens, networks, contracts, service)
    ├── references/    (managed, faroo, snapshot, security, comparative, strategy)
    └── scripts/       (README — Managed não executa scripts)
```

## Checklist rápido

1. Pause → Resume agente (se já existir)
2. Colar Strategy completa → Save
3. Upload `prospilot.zip` → Save
4. Debug: `What is Faroo?` → staking Pharos
5. Debug: `Is this link safe?` → phishing guidance + /chat
6. Publish · preço **Free** (beta)

## Diferencial (comparativo)

ProsPilot = DeFi Pharos **+** Sybil + Link Scanner + Pre-sign Risk + Swap Safety.  
Ver `prospilot/references/COMPARATIVE.md`.

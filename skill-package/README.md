# Pacote Skill — Pharos Agent (Anvita Flow)

Guia oficial: https://docs.pharos.xyz/tooling-and-infrastructure/overview/publish-skill-af

## Regras do pacote (docs Pharos)

1. **`SKILL.md` em MAIÚSCULAS** — `skill.md` minúsculo **não passa** na validação
2. **ZIP da pasta**, não dos arquivos soltos:

```
pharos-agent.zip
└── pharos-agent/
    ├── SKILL.md            ← obrigatório, MAIÚSCULAS
    ├── scripts/
    ├── references/
    └── assets/
```

3. **Frontmatter** — `name` deve ser **igual** ao nome da pasta:

```yaml
---
name: pharos-agent
description: ...
---
```

## Upload

Arquivo: **`skill-package/pharos-agent.zip`**

Console: https://flow.anvita.xyz/service-agents → **Create A Managed Service Agent**

## Regenerar o ZIP

```powershell
.\skill-package\pack.ps1
```

**Não use** `Compress-Archive` (paths com `\` quebram o upload).

## Passo a passo completo

| # | Etapa | Onde |
|---|-------|------|
| 1 | Preparar pacote com `SKILL.md` | `skill-package/pharos-agent/` |
| 2 | Zipar pasta `pharos-agent/` | `pharos-agent.zip` |
| 3 | Conta Anvita Flow | https://flow.anvita.xyz/home |
| 4 | Developer Console | https://flow.anvita.xyz/service-agents |
| 5 | Upload ZIP + Customer Service Strategy + Runtime | Create Agent |
| 6 | Debug (1 teste end-to-end) | Debug tab |
| 7 | Agent Card + Publish | Publish tab |
| 8 | Preço | **Free** (beta) |
| 9 | Wallet earnings (opcional) | https://flow.anvita.xyz/dashboard |

## Se o upload falhar

| Erro | Correção |
|------|----------|
| Skill package must contain SKILL.md | Regenerar com `pack.ps1` |
| skill.md not recognized | Renomear para **SKILL.md** (S maiúsculo) |
| Frontmatter mismatch | `name: pharos-agent` = pasta `pharos-agent/` |

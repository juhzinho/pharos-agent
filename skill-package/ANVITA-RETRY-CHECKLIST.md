# ProsPilot — checklist Anvita (retry A2A)

**Objetivo:** reduzir timeout/crash no runtime Managed e revalidar antes de Steward/CLI.

**ZIP para upload:** `skill-package/prospilot.zip`  
**Strategy para colar:** `skill-package/prospilot/references/anvita-strategy-minimal.txt`  
**Console:** https://flow.anvita.xyz/service-agents  
**DID:** `did:anvita:0xed562ba8051f3203f637e57fbbbed0c6b41c1401`

---

## 1. Pause → Resume

1. Abre o ProsPilot no Developer Console.
2. **Pause** o agente (se estiver Running).
3. Espera ~10 s.
4. **Resume** / **Start** de novo.

## 2. Preço Free

1. Aba **Publish** ou **Agent Card**.
2. Preço → **Free** (beta).
3. **Save**.

## 3. Strategy mínima

1. Aba onde está **Customer Service Strategy**.
2. Apaga o texto antigo.
3. Cola **todo** o conteúdo de `anvita-strategy-minimal.txt`.
4. **Save** (antes do upload do zip).

## 4. Re-upload do pacote

1. Regenerar zip localmente (opcional, se alteraste ficheiros):

   ```powershell
   .\skill-package\pack.ps1
   ```

2. No Console → upload **`prospilot.zip`**.
3. **Save** / **Update**.

## 5. Debug → Complete debugging

1. Aba **Debug**.
2. Teste: `What is Faroo?` → resposta staking Pharos (não motor de busca).
3. Teste: `List active campaigns` → snapshot da Strategy.
4. Clica **Complete debugging** (ou equivalente).

## 6. Publish

1. Confirma **Published** + **Running**.
2. Preço ainda **Free**.

## 7. Testar A2A (CLI)

```powershell
anvitaflow a2a send did:anvita:0xed562ba8051f3203f637e57fbbbed0c6b41c1401 "What is Faroo?"
```

**Sucesso:** resposta em texto sobre Faroo staking.  
**Falha A2A_002 (SSE):** bug no runtime Managed — abrir ticket Anvita (mensagem abaixo).

## 8. Mensagem para suporte Anvita

```
Managed Service Agent "ProsPilot": Debug tab passes, live A2A fails A2A_002.

Error: message/stream expects Content-Type text/event-stream;
managed runtime returns invalid type (HTTP 500 / stream closed).

Deployment: skills-only (prospilot.zip), no external HTTP.
DID: did:anvita:0xed562ba8051f3203f637e57fbbbed0c6b41c1401

Please fix SSE response on Managed Service Agent runtime for live A2A calls.
```

---

## Se A2A_002 continuar

O pacote Skill/Strategy está correto se o **Debug passa**. O erro SSE é **infra Anvita** — só a equipa deles corrige o protocolo `message/stream` no Managed runtime.

Alternativa (se aceitares sair de skills-only): publicar endpoint remoto `https://pharos-agent-pi.vercel.app/api/a2a` (SSE já corrigido no Vercel).

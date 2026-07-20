# Mensagens Discord — Echo / feedback Anvita

Copia conforme o tópico.

---

## LLM

```
On Anvita Managed it's Anvita's hosted sandbox LLM — we don't pick the model there.
Our web app + remote A2A (Vercel) uses llama-3.3-70b via Groq/Cerebras — that's separate from the Managed listing.
```

---

## Deep think + credits (curto)

```
Valid feedback — basic Qs shouldn't burn heavy reasoning.
We trimmed the Strategy with a fast-path for simple intents (Faroo, campaigns, price).
Managed runtime + credits are still Anvita-side; we're optimizing our prompt/context size.
```

---

## Updates (code → Anvita?)

```
Vercel/git push does NOT auto-update the Anvita Managed agent.
Anvita: edit Strategy + re-upload skill zip in Developer Console → Save.
Two stacks: Managed (marketplace) vs Vercel (web app / optional remote A2A).
```

---

## Response time

```
Targeting <15–20s for basic questions after the Strategy trim.
Live A2A on Managed still blocked by Anvita SSE bug (A2A_002) — Debug works; we're on their support for that.
```

---

## Tudo numa mensagem (se quiseres uma só)

```
Thanks Echo — super helpful.

1) LLM: Anvita Managed = their hosted model (we don't control it). Our Vercel stack = llama-3.3-70b Groq/Cerebras.

2) Deep think/creds: we're adding a fast-path in Strategy so basic Qs stay short and cheap. Large skill pack was for accuracy (Faroo disambiguation etc).

3) Code updates: git/Vercel does NOT sync to Anvita Managed — only Strategy + zip re-upload in the Console.

4) Latency: aiming <20s on simple Qs. Live A2A still waiting on Anvita SSE fix (debug passes).
```

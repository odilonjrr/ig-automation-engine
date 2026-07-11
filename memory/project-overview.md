---
name: project-overview
description: What the ig-automation-engine app is and the pipeline it implements
metadata:
  type: project
---

App para automatizar 100% de uma conta Instagram, baseado no "The Full Automation Playbook" (@zero.canon_ / @piyush.glitch). Pipeline de 4 camadas rodando em lote 1x/dia:

- **Sense**: capta tendências (YouTube Data API + Instagram Graph API), score = `(likes*1 + comments*3 + shares*5) / reach`. Regras do playbook: manter top 15-20%, freshness < 48h, dedup 14 dias, re-score diário.
- **Think**: GPT-4.1-mini escreve caption+hooks (JSON) + Claude escreve 1 prompt de imagem por slide, injetando o "DNA visual" fixo (base_style_prompt) em cada slide.
- **Make**: gera imagens. Playbook self-hosted usa GPT Image 2; versão low-cost recomenda Flux via Fal.ai/Replicate (~$0.002/img).
- **Ship**: Meta Graph API 2 passos (`/media` → `/media_publish`), horário aleatório na janela diária, comment-to-DM via webhook nativo (Fase 8).

Stack do scaffold: Next.js 14 + Supabase (Postgres + Storage + Auth). Multi-conta. Custo-alvo ~$1-5/mês (1 conta, 1 post/dia). Ver [[scaffold-vs-playbook-gaps]] e [[project-decisions]].

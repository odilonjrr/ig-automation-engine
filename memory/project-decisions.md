---
name: project-decisions
description: Key build decisions the user made for ig-automation-engine
metadata:
  type: project
---

Decisões confirmadas pelo usuário (2026-07-10):

1. **Ponto de partida**: revisar o scaffold Next.js/Supabase existente antes de codar, alinhando-o ao playbook (não recomeçar do zero).
2. **Camada Make (geração de imagem)**: suportar **ambos** os provedores de forma configurável por conta — Flux (Fal.ai/Replicate, barato) E DALL-E/GPT Image (caro, mais fiel). Hoje o scaffold só tem DALL-E 3.
3. **Prioridades de implementação**: (a) Auth real com Supabase Auth substituindo o cookie placeholder `app_user_id`; (b) migrar Make para suportar Flux; (c) teste end-to-end do pipeline Sense→Think→Make→Ship.

**Why**: usuário quer o custo-alvo baixo do playbook (~$1-5/mês) mantendo a opção de qualidade premium; e um pipeline realmente publicando antes de expandir.
**How to apply**: tratar essas 3 frentes como o backlog imediato. Ver [[scaffold-vs-playbook-gaps]].

-- ============================================================
-- Fase 5 (Make) — bucket de Storage para as imagens geradas
-- ============================================================

insert into storage.buckets (id, name, public)
values ('slides', 'slides', true)
on conflict (id) do nothing;

-- Leitura pública (necessária: a Graph API do Instagram busca a imagem
-- diretamente por URL ao publicar — não há autenticação nessa chamada)
create policy "public_read_slides"
  on storage.objects for select
  using (bucket_id = 'slides');

-- Apenas o service role (usado nas API routes/cron) pode escrever —
-- o client nunca faz upload direto.
create policy "service_role_write_slides"
  on storage.objects for insert
  with check (bucket_id = 'slides' and auth.role() = 'service_role');

create policy "service_role_update_slides"
  on storage.objects for update
  using (bucket_id = 'slides' and auth.role() = 'service_role');

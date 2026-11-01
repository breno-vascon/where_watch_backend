-- =============================================================================
-- Agendamento do tick no Supabase (pg_cron + pg_net)
--
-- A cada 10 min, o Postgres do Supabase chama POST /internal/jobs/tick no Render.
-- Isso executa os jobs vencidos e mantém o web service grátis acordado.
--
-- Como aplicar: Supabase > SQL Editor, executar os passos em ordem.
-- ESTE ARQUIVO NÃO CONTÉM SEGREDOS: o token fica no Supabase Vault.
-- =============================================================================

-- 1) Extensões (uma vez por projeto)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Guardar o token no Vault (uma vez; NÃO versionar o valor).
--    Execute manualmente, trocando <TOKEN> pelo mesmo valor de INTERNAL_JOBS_TOKEN do Render:
--
--    select vault.create_secret('<TOKEN>', 'internal_jobs_token', 'Token do tick do Where Watch');
--
--    Para trocar depois:
--    select vault.update_secret(
--      (select id from vault.secrets where name = 'internal_jobs_token'), '<NOVO_TOKEN>');

-- 3) Agendar o tick. Troque <APP> pelo nome do serviço no Render.
--    Reexecutar com o mesmo nome substitui o agendamento existente.
select cron.schedule(
  'where-watch-tick',
  '*/10 * * * *',
  $$
  select net.http_post(
    url     := 'https://<APP>.onrender.com/internal/jobs/tick',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'X-Internal-Token', (select decrypted_secret
                                        from vault.decrypted_secrets
                                       where name = 'internal_jobs_token')
               ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 90000  -- cobre o cold start do Render (~1 min)
  );
  $$
);

-- =============================================================================
-- Verificação
-- =============================================================================

-- Agendamentos ativos
-- select jobid, jobname, schedule, active from cron.job;

-- Últimas execuções do pg_cron
-- select status, return_message, start_time
--   from cron.job_run_details order by start_time desc limit 10;

-- Últimas respostas HTTP (esperado: status_code = 202)
-- select id, status_code, error_msg, created
--   from net._http_response order by created desc limit 10;

-- Execuções registradas pelo backend (esperado: heartbeat SUCCESS a cada ~10 min)
-- select job_name, status, trigger, started_at
--   from job_runs order by started_at desc limit 20;

-- Pausar / remover
-- select cron.unschedule('where-watch-tick');

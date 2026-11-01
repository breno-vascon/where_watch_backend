# Where Watch — Backend

API do **Where Watch**: lista jogos de futebol filtrados pelas plataformas de transmissão que o usuário assina (TV aberta, TV paga, streaming e YouTube).

Escopo da v1: Brasileirão Série A, Premier League, LaLiga, Serie A, Bundesliga e Ligue 1, com transmissões no Brasil.

**Stack:** Node.js 24 · NestJS 12 (ESM) · TypeScript estrito · Prisma 7 + PostgreSQL (Supabase) · Vitest · oxlint · Render.

---

## Rodando localmente

```bash
npm install                 # também gera o Prisma Client (postinstall)
cp .env.example .env        # preencher DATABASE_URL, DIRECT_URL e INTERNAL_JOBS_TOKEN
npm run prisma:deploy       # aplica as migrações no banco
npm run start:dev           # http://localhost:3000
```

- Swagger: http://localhost:3000/docs (ligado fora de produção)
- Health: http://localhost:3000/health

A aplicação **não sobe** se faltar variável obrigatória e informa quais estão inválidas. Ela sobe com o banco fora do ar; nesse caso o `/health` responde `degraded`.

### Scripts

| Script | O que faz |
|---|---|
| `start:dev` | Servidor com reload |
| `build` / `start:prod` | Build e execução de produção (`dist/main.js`) |
| `lint` | oxlint (inclui as regras de fronteira entre camadas) |
| `format` / `format:check` | Prettier |
| `typecheck` | `tsc --noEmit` |
| `test` / `test:e2e` | Testes unitários / e2e (Vitest) |
| `prisma:migrate` | Cria uma migração nova em desenvolvimento (`prisma migrate dev`) |
| `prisma:deploy` | Aplica as migrações pendentes |

### Variáveis de ambiente

Ver [`.env.example`](.env.example). Resumo:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Supabase, **transaction pooler** (porta 6543). Usada em runtime |
| `DIRECT_URL` | para migrações | Supabase, conexão direta ou session pooler (porta 5432). Usada pelo Prisma CLI |
| `INTERNAL_JOBS_TOKEN` | sim | Segredo das rotas `/internal/*` (mín. 32 caracteres) |
| `APP_TIMEZONE` | não | Padrão `America/Sao_Paulo`; usado na agenda dos jobs |
| `LOG_LEVEL` | não | Padrão `info` |
| `SWAGGER_ENABLED` | não | Padrão: ligado fora de produção |

---

## Arquitetura

Cada módulo de negócio em `src/modules/<módulo>/` segue as mesmas camadas:

```
controllers/   HTTP: valida entrada (DTOs), chama UM usecase, formata a saída
usecases/      um caso de uso por classe; orquestra domain + ports
domain/        regras e tipos puros (sem NestJS, Prisma ou HTTP); 100% testável
ports/         interfaces (contratos) que os usecases usam + tokens de injeção
adapters/      implementações dos ports: Prisma, APIs externas, SDKs
<nome>.module.ts   liga cada port ao seu adapter (injeção de dependência)
```

**Regras de import (verificadas pelo `npm run lint`):**

| Camada | Pode importar | Não pode importar |
|---|---|---|
| controllers | usecases, DTOs | adapters, ports, Prisma |
| usecases | domain, ports, `shared/config`, `shared/errors` | adapters, controllers, Prisma, SDKs |
| domain / ports | outros arquivos de domain/ports | NestJS, Prisma, adapters, usecases |
| adapters | ports, domain, libs externas | — |

Arquivos de teste (`*.spec.ts`, `test/`) estão liberados das regras.

Código transversal fica em `src/shared/`: `config/` (variáveis validadas com zod), `database/` (PrismaService, só para adapters), `logger/` (pino), `errors/` (erros de domínio + filtro HTTP) e `auth/` (guards).

**Erros:** usecases lançam `NotFoundError`, `ValidationError` ou `ConflictError` (`shared/errors/domain-error.ts`). O filtro global converte para HTTP com o formato `{ "error": { "code", "message", "details?" } }`.

**Injeção:** sempre explícita com `@Inject(TOKEN_OU_CLASSE)`. Ports usam um `Symbol` como token.

### Banco de dados

- `snake_case` no banco (`@map`/`@@map`), `camelCase` no código.
- **Toda tabela nova deve ter RLS ativado na migração** (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`). Sem isso, a tabela fica exposta na API REST automática do Supabase. O backend conecta como `postgres` e não é afetado.
- O Prisma Client é gerado em `src/generated/prisma` (ignorado pelo git).

---

## Jobs agendados

O Render grátis hiberna após 15 min sem tráfego, e cron jobs são pagos. Por isso o agendamento fica no Supabase:

```
pg_cron (a cada 10 min) ──pg_net──► POST /internal/jobs/tick  (header X-Internal-Token)
                                          │ responde 202 na hora
                                          ▼
                     RunTickUseCase: executa, em sequência, os jobs vencidos
                     (lock + histórico na tabela job_runs)
```

- SQL de configuração: [`infra/supabase/tick-schedule.sql`](infra/supabase/tick-schedule.sql)
- Execução manual: `POST /internal/jobs/:name/run`
- Histórico: `GET /internal/jobs/runs?limit=50`
- O job `heartbeat` roda a cada tick. Linhas contínuas dele em `job_runs` indicam que o agendamento está funcionando.

### Criando um job

1. Crie a classe no módulo dono da regra (ex.: `src/modules/ingestion/jobs/sync-fixtures.job.ts`):

   ```ts
   @ScheduledJob()
   @Injectable()
   export class SyncFixturesJob implements Job {
     readonly name = 'sync-fixtures';                          // kebab-case, único
     readonly schedule: JobSchedule = { kind: 'daily', at: '04:00' }; // ou { kind: 'every', minutes: 30 }

     constructor(@Inject(SyncFixturesUseCase) private readonly sync: SyncFixturesUseCase) {}

     run(): Promise<JobStats> {
       return this.sync.execute();                             // o job só delega para um usecase
     }
   }
   ```

2. Registre-a em `providers` do módulo. O `DiscoveryJobRegistry` encontra o job ao subir a aplicação e valida nome e agenda.

Regras: o job deve ser **idempotente** (pode rodar duas vezes) e **curto**. Uma execução `RUNNING` há mais de 15 min é considerada abandonada.

---

## Deploy

- **Render:** Blueprint em [`render.yaml`](render.yaml) (web service grátis). O build roda `prisma migrate deploy`. Os segredos (`DATABASE_URL`, `DIRECT_URL`, `INTERNAL_JOBS_TOKEN`) são preenchidos no painel.
- **Supabase:** executar [`infra/supabase/tick-schedule.sql`](infra/supabase/tick-schedule.sql) após o primeiro deploy.
- **CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda formatação, lint, typecheck, testes e build.

### Backup

[`.github/workflows/db-backup.yml`](.github/workflows/db-backup.yml) faz `pg_dump` semanal (e sob demanda) do schema `public` e salva como artifact privado por 90 dias. Requer o secret `DIRECT_URL` no GitHub.

Para restaurar (baixe o artifact antes):

```bash
pg_restore --no-owner --no-privileges --clean --if-exists -d "$DIRECT_URL" where-watch-<data>.dump
```

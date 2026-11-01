-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED_LOCKED');

-- CreateEnum
CREATE TYPE "JobTrigger" AS ENUM ('TICK', 'MANUAL');

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job_name" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),
    "status" "JobRunStatus" NOT NULL,
    "trigger" "JobTrigger" NOT NULL,
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_runs_job_name_started_at_idx" ON "job_runs"("job_name", "started_at");


-- Segurança (Supabase): tabelas no schema public ficam expostas na API REST
-- automática. RLS ativado sem policies bloqueia anon/authenticated; o backend
-- conecta como postgres (ignora RLS). Convenção: TODA tabela nova faz isso.
ALTER TABLE "job_runs" ENABLE ROW LEVEL SECURITY;

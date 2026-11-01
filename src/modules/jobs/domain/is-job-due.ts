import { dailyAtToMinutes, type JobSchedule } from './job.js';

/**
 * Folga para jobs `every`: o tick roda a cada ~10 min com pequenas variações.
 * Sem folga, um job de 30 min executado há 29m58s esperaria até o próximo tick.
 */
export const EVERY_TOLERANCE_MS = 60_000;

/**
 * Decide se um job deve rodar agora.
 *
 * - `every`: venceu se nunca rodou ou se já passou o intervalo (com folga).
 * - `daily`: venceu se já passou do horário de hoje (no fuso informado)
 *   e ainda não houve execução bem-sucedida hoje depois desse horário.
 */
export function isJobDue(
  schedule: JobSchedule,
  lastSuccessAt: Date | null,
  now: Date,
  timezone: string,
): boolean {
  if (schedule.kind === 'every') {
    if (!lastSuccessAt) return true;
    const elapsed = now.getTime() - lastSuccessAt.getTime();
    return elapsed >= schedule.minutes * 60_000 - EVERY_TOLERANCE_MS;
  }

  const scheduledMinutes = dailyAtToMinutes(schedule.at);
  const today = localDateTime(now, timezone);

  if (today.minutes < scheduledMinutes) return false;
  if (!lastSuccessAt) return true;

  const last = localDateTime(lastSuccessAt, timezone);
  const alreadyRanToday =
    last.date === today.date && last.minutes >= scheduledMinutes;
  return !alreadyRanToday;
}

interface LocalDateTime {
  /** `YYYY-MM-DD` no fuso informado. */
  date: string;
  /** Minutos desde a meia-noite no fuso informado. */
  minutes: number;
}

function localDateTime(instant: Date, timezone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00';

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

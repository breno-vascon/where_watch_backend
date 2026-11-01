import { isJobDue } from './is-job-due.js';
import { validateJobDefinition } from './job.js';

const TZ = 'America/Sao_Paulo'; // UTC-3, sem horário de verão
const at = (iso: string) => new Date(iso);

describe('isJobDue', () => {
  describe('every', () => {
    const every30 = { kind: 'every', minutes: 30 } as const;

    it('vence na primeira execução', () => {
      expect(isJobDue(every30, null, at('2026-11-01T12:00:00Z'), TZ)).toBe(
        true,
      );
    });

    it('não vence antes do intervalo', () => {
      expect(
        isJobDue(
          every30,
          at('2026-11-01T12:00:00Z'),
          at('2026-11-01T12:20:00Z'),
          TZ,
        ),
      ).toBe(false);
    });

    it('vence dentro da folga de 1 minuto (tick um pouco adiantado)', () => {
      expect(
        isJobDue(
          every30,
          at('2026-11-01T12:00:00Z'),
          at('2026-11-01T12:29:10Z'),
          TZ,
        ),
      ).toBe(true);
    });

    it('vence quando o tick atrasou muito', () => {
      expect(
        isJobDue(
          every30,
          at('2026-11-01T12:00:00Z'),
          at('2026-11-01T15:00:00Z'),
          TZ,
        ),
      ).toBe(true);
    });
  });

  describe('daily', () => {
    const daily4am = { kind: 'daily', at: '04:00' } as const; // 04:00 BRT = 07:00 UTC

    it('não vence antes do horário local', () => {
      expect(isJobDue(daily4am, null, at('2026-11-01T06:50:00Z'), TZ)).toBe(
        false,
      );
    });

    it('vence após o horário quando nunca rodou', () => {
      expect(isJobDue(daily4am, null, at('2026-11-01T07:05:00Z'), TZ)).toBe(
        true,
      );
    });

    it('não vence de novo no mesmo dia após rodar', () => {
      expect(
        isJobDue(
          daily4am,
          at('2026-11-01T07:05:00Z'),
          at('2026-11-01T20:00:00Z'),
          TZ,
        ),
      ).toBe(false);
    });

    it('vence se a última execução no dia foi antes do horário (ex.: manual de madrugada)', () => {
      expect(
        isJobDue(
          daily4am,
          at('2026-11-01T05:00:00Z'),
          at('2026-11-01T07:10:00Z'),
          TZ,
        ),
      ).toBe(true);
    });

    it('vence no dia seguinte', () => {
      expect(
        isJobDue(
          daily4am,
          at('2026-11-01T07:05:00Z'),
          at('2026-11-02T07:05:00Z'),
          TZ,
        ),
      ).toBe(true);
    });

    it('usa a data local, não a UTC (23h BRT ainda é o mesmo dia)', () => {
      // 01/11 23:30 BRT = 02/11 02:30 UTC: já rodou "hoje" (01/11) às 04:05 BRT.
      expect(
        isJobDue(
          daily4am,
          at('2026-11-01T07:05:00Z'),
          at('2026-11-02T02:30:00Z'),
          TZ,
        ),
      ).toBe(false);
    });
  });
});

describe('validateJobDefinition', () => {
  it('aceita uma definição válida', () => {
    expect(
      validateJobDefinition({
        name: 'sync-fixtures',
        schedule: { kind: 'daily', at: '04:00' },
      }),
    ).toEqual([]);
  });

  it('rejeita nome fora de kebab-case e agenda inválida', () => {
    expect(
      validateJobDefinition({
        name: 'SyncFixtures',
        schedule: { kind: 'every', minutes: 0 },
      }),
    ).toHaveLength(2);
    expect(
      validateJobDefinition({
        name: 'ok',
        schedule: { kind: 'daily', at: '24:00' },
      }),
    ).toHaveLength(1);
  });
});

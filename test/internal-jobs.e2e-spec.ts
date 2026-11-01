import request from 'supertest';
import {
  createTestApp,
  TEST_INTERNAL_TOKEN,
  type TestApp,
} from './create-test-app.js';

const TOKEN_HEADER = 'X-Internal-Token';

describe('/internal/jobs', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(() => {
    ctx.jobRuns.records.length = 0;
  });

  it('recusa chamadas sem token', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/internal/jobs/tick')
      .expect(401);

    expect(res.body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('recusa token errado', async () => {
    await request(ctx.app.getHttpServer())
      .post('/internal/jobs/tick')
      .set(TOKEN_HEADER, 'x'.repeat(40))
      .expect(401);
  });

  it('tick responde 202 e executa o heartbeat em seguida', async () => {
    await request(ctx.app.getHttpServer())
      .post('/internal/jobs/tick')
      .set(TOKEN_HEADER, TEST_INTERNAL_TOKEN)
      .expect(202, { accepted: true });

    await vi.waitFor(() => {
      expect(ctx.jobRuns.records).toContainEqual(
        expect.objectContaining({
          jobName: 'heartbeat',
          trigger: 'TICK',
          status: 'SUCCESS',
        }),
      );
    });
  });

  it('executa um job manualmente', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/internal/jobs/heartbeat/run')
      .set(TOKEN_HEADER, TEST_INTERNAL_TOKEN)
      .expect(200);

    expect(res.body).toMatchObject({
      jobName: 'heartbeat',
      status: 'SUCCESS',
      stats: { ok: true },
    });
    expect(ctx.jobRuns.records[0]).toMatchObject({ trigger: 'MANUAL' });
  });

  it('retorna 404 para job inexistente', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/internal/jobs/nao-existe/run')
      .set(TOKEN_HEADER, TEST_INTERNAL_TOKEN)
      .expect(404);

    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('valida o nome do job', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/internal/jobs/Nome_Invalido/run')
      .set(TOKEN_HEADER, TEST_INTERNAL_TOKEN)
      .expect(400);

    expect(res.body.error.details).toEqual(['name deve estar em kebab-case']);
  });

  it('lista as execuções recentes, respeitando o limite', async () => {
    const server = ctx.app.getHttpServer();
    for (let i = 0; i < 3; i++) {
      await request(server)
        .post('/internal/jobs/heartbeat/run')
        .set(TOKEN_HEADER, TEST_INTERNAL_TOKEN);
    }

    const res = await request(server)
      .get('/internal/jobs/runs?limit=2')
      .set(TOKEN_HEADER, TEST_INTERNAL_TOKEN)
      .expect(200);

    expect(res.body).toHaveLength(2);
  });

  it('rejeita limite fora do intervalo', async () => {
    await request(ctx.app.getHttpServer())
      .get('/internal/jobs/runs?limit=500')
      .set(TOKEN_HEADER, TEST_INTERNAL_TOKEN)
      .expect(400);
  });
});

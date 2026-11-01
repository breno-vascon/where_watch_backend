import request from 'supertest';
import { createTestApp, type TestApp } from './create-test-app.js';

describe('GET /health', () => {
  let ctx: TestApp;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('retorna ok com o banco disponível', async () => {
    ctx.setDatabaseUp(true);

    const res = await request(ctx.app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(res.body).toMatchObject({ status: 'ok', db: 'ok' });
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('retorna degraded (ainda 200) com o banco fora', async () => {
    ctx.setDatabaseUp(false);

    const res = await request(ctx.app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(res.body).toMatchObject({ status: 'degraded', db: 'down' });
  });

  it('usa o formato padrão de erro para rotas inexistentes', async () => {
    const res = await request(ctx.app.getHttpServer())
      .get('/nao-existe')
      .expect(404);

    expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});

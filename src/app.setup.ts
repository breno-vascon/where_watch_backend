import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INTERNAL_TOKEN_HEADER } from './shared/auth/internal-token.guard.js';
import { APP_CONFIG } from './shared/config/config.module.js';
import type { AppConfig } from './shared/config/env.schema.js';
import { HttpExceptionFilter } from './shared/errors/http-exception.filter.js';

/**
 * Configuração HTTP compartilhada entre o main.ts e os testes e2e,
 * para que os testes exercitem a mesma pilha da produção.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<AppConfig>(APP_CONFIG);

  // Rotas públicas futuras: /v1/... (health e internal são VERSION_NEUTRAL).
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Where Watch API')
        .setDescription(
          'Jogos de futebol filtrados pelas plataformas de transmissão do usuário.',
        )
        .setVersion('0.0.1')
        .addApiKey(
          { type: 'apiKey', in: 'header', name: INTERNAL_TOKEN_HEADER },
          'internal-token',
        )
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}

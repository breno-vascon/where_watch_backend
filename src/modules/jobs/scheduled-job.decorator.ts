import { SetMetadata } from '@nestjs/common';

export const SCHEDULED_JOB_METADATA = Symbol('SCHEDULED_JOB');

/**
 * Marca um provider como job agendado. A classe deve implementar `Job`
 * (domain/job.ts) e ser registrada como provider do seu módulo:
 *
 * ```ts
 * @ScheduledJob()
 * @Injectable()
 * export class SyncFixturesJob implements Job { ... }
 * ```
 *
 * O DiscoveryJobRegistry encontra todos os providers marcados ao subir a aplicação.
 */
export const ScheduledJob = (): ClassDecorator =>
  SetMetadata(SCHEDULED_JOB_METADATA, true);

import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'degraded'] })
  status!: 'ok' | 'degraded';

  @ApiProperty({ enum: ['ok', 'down'] })
  db!: 'ok' | 'down';

  @ApiProperty({ example: 120 })
  uptimeSeconds!: number;
}

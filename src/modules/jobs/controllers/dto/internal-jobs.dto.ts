import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class JobNameParamDto {
  @ApiProperty({ example: 'heartbeat' })
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'name deve estar em kebab-case',
  })
  name!: string;
}

export class ListJobRunsQueryDto {
  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit: number = 50;
}

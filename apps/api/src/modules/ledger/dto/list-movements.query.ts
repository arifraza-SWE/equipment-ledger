import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IsIdentifier } from '../../../common/validation/identifier';
import { IsInstant } from '../../../common/validation/is-instant.decorator';
import { MAX_PAGE_SIZE } from '../ledger-movements.query';

export class ListMovementsQuery {
  @IsOptional()
  @IsIdentifier('assetId')
  assetId?: string;

  @IsOptional()
  @IsIdentifier('workerId')
  workerId?: string;

  @IsOptional()
  @IsInstant()
  from?: string;

  @IsOptional()
  @IsInstant()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;
}

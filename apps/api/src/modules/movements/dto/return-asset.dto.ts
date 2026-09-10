import type { ReturnAssetRequest } from '@equipment-ledger/shared';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsIdentifier } from '../../../common/validation/identifier';
import { IsInstant } from '../../../common/validation/is-instant.decorator';

export class ReturnAssetDto implements ReturnAssetRequest {
  @IsIdentifier('assetId')
  assetId: string;

  @IsIdentifier('returnedByWorkerId')
  returnedByWorkerId: string;

  @IsIdentifier('keeperId')
  keeperId: string;

  @IsInstant()
  effectiveAt: string;

  @IsOptional()
  @IsBoolean()
  acknowledgeDifferentReturner?: boolean;

  @IsOptional()
  @IsBoolean()
  takeOutOfService?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

import type { IssueAssetRequest } from '@equipment-ledger/shared';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsIdentifier } from '../../../common/validation/identifier';
import { IsInstant } from '../../../common/validation/is-instant.decorator';

export class IssueAssetDto implements IssueAssetRequest {
  @IsIdentifier('assetId')
  assetId: string;

  @IsIdentifier('workerId')
  workerId: string;

  @IsIdentifier('keeperId')
  keeperId: string;

  @IsInstant()
  effectiveAt: string;

  @IsOptional()
  @IsInstant()
  dueAt?: string | null;

  @IsOptional()
  @IsMongoId({ message: 'reservationId must be a reservation identifier' })
  reservationId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

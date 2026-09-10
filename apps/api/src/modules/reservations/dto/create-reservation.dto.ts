import type { CreateReservationRequest } from '@equipment-ledger/shared';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsIdentifier } from '../../../common/validation/identifier';
import { IsInstant } from '../../../common/validation/is-instant.decorator';

export class CreateReservationDto implements CreateReservationRequest {
  @IsIdentifier('assetId')
  assetId: string;

  @IsIdentifier('workerId')
  workerId: string;

  @IsIdentifier('keeperId')
  keeperId: string;

  @IsInstant()
  startsAt: string;

  @IsInstant()
  endsAt: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

import { RESERVATION_STATUSES, type ReservationStatus } from '@equipment-ledger/shared';
import { IsIn, IsOptional } from 'class-validator';
import { IsIdentifier } from '../../../common/validation/identifier';
import { IsInstant } from '../../../common/validation/is-instant.decorator';

export class ListReservationsQuery {
  @IsOptional()
  @IsIdentifier('assetId')
  assetId?: string;

  @IsOptional()
  @IsIdentifier('workerId')
  workerId?: string;

  @IsOptional()
  @IsIn(RESERVATION_STATUSES)
  status?: ReservationStatus;

  @IsOptional()
  @IsInstant()
  from?: string;

  @IsOptional()
  @IsInstant()
  to?: string;
}

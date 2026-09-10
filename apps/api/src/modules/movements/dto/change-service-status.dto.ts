import { type ChangeServiceStatusRequest, SERVICE_STATUSES, type ServiceStatus } from '@equipment-ledger/shared';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { IsIdentifier } from '../../../common/validation/identifier';
import { IsInstant } from '../../../common/validation/is-instant.decorator';

export class ChangeServiceStatusDto implements ChangeServiceStatusRequest {
  @IsIn(SERVICE_STATUSES, { message: 'status must be "in_service" or "out_of_service"' })
  status: ServiceStatus;

  @IsIdentifier('keeperId')
  keeperId: string;

  @IsString()
  @Length(3, 500, { message: 'reason must say why in 3 to 500 characters' })
  reason: string;

  @IsOptional()
  @IsInstant()
  effectiveAt?: string;
}

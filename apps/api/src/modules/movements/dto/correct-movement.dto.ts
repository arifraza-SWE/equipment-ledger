import {
  CORRECTION_KINDS,
  type CorrectionKind,
  type CorrectMovementRequest,
} from '@equipment-ledger/shared';
import { IsIn, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { IsIdentifier } from '../../../common/validation/identifier';
import { IsInstant } from '../../../common/validation/is-instant.decorator';

export class CorrectMovementDto implements CorrectMovementRequest {
  @IsIn(CORRECTION_KINDS, { message: 'kind must be "amend" or "void"' })
  kind: CorrectionKind;

  @IsString()
  @Length(3, 500, { message: 'reason must explain the correction in 3 to 500 characters' })
  reason: string;

  @IsIdentifier('keeperId')
  keeperId: string;

  @IsOptional()
  @IsInstant()
  effectiveAt?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsIdentifier('workerId')
  workerId?: string;

  @ValidateIf((_dto, value) => value !== undefined)
  @IsIdentifier('returnedByWorkerId')
  returnedByWorkerId?: string;

  @IsOptional()
  @IsInstant()
  dueAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

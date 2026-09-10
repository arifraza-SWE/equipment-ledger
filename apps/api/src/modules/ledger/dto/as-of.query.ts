import { IsOptional } from 'class-validator';
import { IsInstant } from '../../../common/validation/is-instant.decorator';

export class AsOfQuery {
  @IsOptional()
  @IsInstant()
  at?: string;
}

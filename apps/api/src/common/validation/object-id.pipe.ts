import { Injectable, type PipeTransform } from '@nestjs/common';
import { Types } from 'mongoose';
import { NotFoundError } from '../errors/domain-error';

@Injectable()
export class ObjectIdPipe implements PipeTransform<string, string> {
  transform(candidate: string): string {
    if (!Types.ObjectId.isValid(candidate) || String(new Types.ObjectId(candidate)) !== candidate) {
      throw new NotFoundError(`"${candidate}" is not a valid identifier.`);
    }
    return candidate;
  }
}

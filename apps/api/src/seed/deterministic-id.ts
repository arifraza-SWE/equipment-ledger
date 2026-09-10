import { createHash } from 'node:crypto';
import { Types } from 'mongoose';

/** The same label always yields the same ObjectId, so two seed runs write byte-identical documents. */
export function deterministicObjectId(label: string): Types.ObjectId {
  return new Types.ObjectId(createHash('sha1').update(label).digest('hex').slice(0, 24));
}

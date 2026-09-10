import { Injectable } from '@nestjs/common';
import type { PaginatedMovements } from '@equipment-ledger/shared';
import { MovementNamesService } from './movement-names.service';
import { type MovementListFilter, MovementsRepository } from './persistence/movements.repository';

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

@Injectable()
export class LedgerMovementsQuery {
  constructor(
    private readonly movements: MovementsRepository,
    private readonly names: MovementNamesService,
  ) {}

  async list(filter: MovementListFilter, cursor: string | null, limit: number): Promise<PaginatedMovements> {
    const page = await this.movements.list(filter, cursor, Math.min(Math.max(limit, 1), MAX_PAGE_SIZE));
    return {
      movements: await this.names.attachNames(page.records),
      nextCursor: page.nextCursor,
    };
  }
}

import { Controller, Get, Inject, Query } from '@nestjs/common';
import type { PaginatedMovements, StoreSnapshot } from '@equipment-ledger/shared';
import { CLOCK, type Clock } from '../../common/time/clock';
import { requireInstant } from '../../common/time/require-instant';
import { AsOfQuery } from './dto/as-of.query';
import { ListMovementsQuery } from './dto/list-movements.query';
import { DEFAULT_PAGE_SIZE, LedgerMovementsQuery } from './ledger-movements.query';
import { StoreSnapshotService } from './store-snapshot.service';

@Controller('ledger')
export class LedgerController {
  constructor(
    private readonly snapshots: StoreSnapshotService,
    private readonly movementsQuery: LedgerMovementsQuery,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get('as-of')
  async asOf(@Query() query: AsOfQuery): Promise<StoreSnapshot> {
    const instant = query.at ? requireInstant(query.at, 'at') : this.clock.now();
    return this.snapshots.storeAt(instant);
  }

  @Get('movements')
  async movements(@Query() query: ListMovementsQuery): Promise<PaginatedMovements> {
    return this.movementsQuery.list(
      {
        assetId: query.assetId,
        workerId: query.workerId,
        from: query.from ? requireInstant(query.from, 'from') : undefined,
        to: query.to ? requireInstant(query.to, 'to') : undefined,
      },
      query.cursor ?? null,
      query.limit ?? DEFAULT_PAGE_SIZE,
    );
  }
}

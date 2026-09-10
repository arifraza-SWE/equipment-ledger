import { Controller, Get, Param } from '@nestjs/common';
import type { WorkerDetail } from '@equipment-ledger/shared';
import { WorkerDetailService } from './worker-detail.service';

@Controller('workers')
export class WorkerDetailController {
  constructor(private readonly workerDetail: WorkerDetailService) {}

  @Get(':workerId')
  async detail(@Param('workerId') workerId: string): Promise<WorkerDetail> {
    return this.workerDetail.detailOf(workerId);
  }
}

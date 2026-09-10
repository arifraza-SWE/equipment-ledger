import { Controller, Get } from '@nestjs/common';
import type { Worker } from '@equipment-ledger/shared';
import { toWorker, WorkersRepository } from './workers.repository';

@Controller('workers')
export class WorkersController {
  constructor(private readonly workers: WorkersRepository) {}

  @Get()
  async list(): Promise<Worker[]> {
    const records = await this.workers.findAll();
    return records.map(toWorker);
  }
}

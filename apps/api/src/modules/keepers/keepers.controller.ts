import { Controller, Get } from '@nestjs/common';
import type { Keeper } from '@equipment-ledger/shared';
import { KeepersRepository, toKeeper } from './keepers.repository';

@Controller('keepers')
export class KeepersController {
  constructor(private readonly keepers: KeepersRepository) {}

  @Get()
  async list(): Promise<Keeper[]> {
    const records = await this.keepers.findAll();
    return records.map(toKeeper);
  }
}

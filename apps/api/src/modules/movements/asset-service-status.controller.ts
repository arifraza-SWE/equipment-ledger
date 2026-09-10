import { Body, Controller, HttpCode, Param, Post, UseInterceptors } from '@nestjs/common';
import type { ServiceStatusChangeResult } from '@equipment-ledger/shared';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { ChangeServiceStatusUseCase } from './change-service-status.use-case';
import { ChangeServiceStatusDto } from './dto/change-service-status.dto';

@Controller('assets')
@UseInterceptors(IdempotencyInterceptor)
export class AssetServiceStatusController {
  constructor(private readonly changeServiceStatus: ChangeServiceStatusUseCase) {}

  @Post(':assetId/service-status')
  @HttpCode(201)
  async change(
    @Param('assetId') assetId: string,
    @Body() request: ChangeServiceStatusDto,
  ): Promise<ServiceStatusChangeResult> {
    return this.changeServiceStatus.execute(assetId, request);
  }
}

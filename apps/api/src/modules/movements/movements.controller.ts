import { Body, Controller, HttpCode, Param, Post, UseInterceptors } from '@nestjs/common';
import type { CorrectionResult, MovementResult } from '@equipment-ledger/shared';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { ObjectIdPipe } from '../../common/validation/object-id.pipe';
import { CorrectMovementUseCase } from './correct-movement.use-case';
import { CorrectMovementDto } from './dto/correct-movement.dto';
import { IssueAssetDto } from './dto/issue-asset.dto';
import { ReturnAssetDto } from './dto/return-asset.dto';
import { IssueAssetUseCase } from './issue-asset.use-case';
import { ReturnAssetUseCase } from './return-asset.use-case';

@Controller('movements')
@UseInterceptors(IdempotencyInterceptor)
export class MovementsController {
  constructor(
    private readonly issueAsset: IssueAssetUseCase,
    private readonly returnAsset: ReturnAssetUseCase,
    private readonly correctMovement: CorrectMovementUseCase,
  ) {}

  @Post('issues')
  @HttpCode(201)
  async issue(@Body() request: IssueAssetDto): Promise<MovementResult> {
    return this.issueAsset.execute(request);
  }

  @Post('returns')
  @HttpCode(201)
  async recordReturn(@Body() request: ReturnAssetDto): Promise<MovementResult> {
    return this.returnAsset.execute(request);
  }

  @Post(':movementId/corrections')
  @HttpCode(201)
  async correct(
    @Param('movementId', ObjectIdPipe) movementId: string,
    @Body() request: CorrectMovementDto,
  ): Promise<CorrectionResult> {
    return this.correctMovement.execute(movementId, request);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import type { Reservation } from '@equipment-ledger/shared';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { CLOCK, type Clock } from '../../common/time/clock';
import { requireInstant } from '../../common/time/require-instant';
import { ObjectIdPipe } from '../../common/validation/object-id.pipe';
import {
  ReservationsRepository,
  toReservation,
} from '../ledger/persistence/reservations.repository';
import { CancelReservationUseCase } from './cancel-reservation.use-case';
import { CreateReservationUseCase } from './create-reservation.use-case';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { ListReservationsQuery } from './dto/list-reservations.query';

@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservations: ReservationsRepository,
    private readonly createReservation: CreateReservationUseCase,
    private readonly cancelReservation: CancelReservationUseCase,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Get()
  async list(@Query() query: ListReservationsQuery): Promise<Reservation[]> {
    const now = this.clock.now();
    const records = await this.reservations.list({
      assetId: query.assetId,
      workerId: query.workerId,
      status: query.status,
      from: query.from ? requireInstant(query.from, 'from') : undefined,
      to: query.to ? requireInstant(query.to, 'to') : undefined,
    });
    return records.map((record) => toReservation(record, now));
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(IdempotencyInterceptor)
  async create(@Body() request: CreateReservationDto): Promise<Reservation> {
    return this.createReservation.execute(request);
  }

  @Delete(':reservationId')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  async cancel(@Param('reservationId', ObjectIdPipe) reservationId: string): Promise<Reservation> {
    return this.cancelReservation.execute(reservationId);
  }
}

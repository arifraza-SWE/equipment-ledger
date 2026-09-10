import { Module } from '@nestjs/common';
import { AssetsModule } from '../assets/assets.module';
import { LedgerModule } from '../ledger/ledger.module';
import { MovementsModule } from '../movements/movements.module';
import { CancelReservationUseCase } from './cancel-reservation.use-case';
import { CreateReservationUseCase } from './create-reservation.use-case';
import { ReservationsController } from './reservations.controller';

@Module({
  imports: [LedgerModule, AssetsModule, MovementsModule],
  controllers: [ReservationsController],
  providers: [CreateReservationUseCase, CancelReservationUseCase],
})
export class ReservationsModule {}

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CorrectionRecord, CorrectionSchema } from './correction.schema';
import { CorrectionsRepository } from './corrections.repository';
import { MovementRecord, MovementSchema } from './movement.schema';
import { MovementsRepository } from './movements.repository';
import { ReservationRecord, ReservationSchema } from './reservation.schema';
import { ReservationsRepository } from './reservations.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MovementRecord.name, schema: MovementSchema },
      { name: CorrectionRecord.name, schema: CorrectionSchema },
      { name: ReservationRecord.name, schema: ReservationSchema },
    ]),
  ],
  providers: [MovementsRepository, CorrectionsRepository, ReservationsRepository],
  exports: [MovementsRepository, CorrectionsRepository, ReservationsRepository],
})
export class LedgerPersistenceModule {}

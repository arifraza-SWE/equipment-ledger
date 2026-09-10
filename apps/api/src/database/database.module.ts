import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionRunner } from './transaction-runner';

export const MONGODB_URI = Symbol('MONGODB_URI');

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(mongoUri: string) {
    return {
      module: DatabaseModule,
      imports: [MongooseModule.forRoot(mongoUri, { autoIndex: true, autoCreate: true })],
      providers: [TransactionRunner, { provide: MONGODB_URI, useValue: mongoUri }],
      exports: [TransactionRunner, MongooseModule, MONGODB_URI],
    };
  }
}

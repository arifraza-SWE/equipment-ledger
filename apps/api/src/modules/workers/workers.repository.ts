import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Worker, WorkerSummary } from '@equipment-ledger/shared';
import { type ClientSession, Model } from 'mongoose';
import { WorkerRecord } from './worker.schema';

export interface NewWorker {
  workerId: string;
  fullName: string;
  trade: string;
  certifications: WorkerRecord['certifications'];
  registeredAt: Date;
}

@Injectable()
export class WorkersRepository {
  constructor(@InjectModel(WorkerRecord.name) private readonly workers: Model<WorkerRecord>) {}

  async findAll(): Promise<WorkerRecord[]> {
    return this.workers.find().sort({ _id: 1 }).lean();
  }

  async findById(workerId: string, session?: ClientSession): Promise<WorkerRecord | null> {
    return this.workers
      .findById(workerId)
      .session(session ?? null)
      .lean();
  }

  async findByIds(workerIds: readonly string[]): Promise<Map<string, WorkerRecord>> {
    const uniqueIds = [...new Set(workerIds)];
    if (uniqueIds.length === 0) {
      return new Map();
    }
    const records = await this.workers.find({ _id: { $in: uniqueIds } }).lean();
    return new Map(records.map((record) => [record._id, record]));
  }

  async insertMany(newWorkers: NewWorker[]): Promise<void> {
    await this.workers.insertMany(
      newWorkers.map((newWorker) => ({
        _id: newWorker.workerId,
        fullName: newWorker.fullName,
        trade: newWorker.trade,
        certifications: newWorker.certifications,
        registeredAt: newWorker.registeredAt,
      })),
    );
  }

  async deleteAll(): Promise<void> {
    await this.workers.deleteMany({});
  }
}

export function toWorker(record: WorkerRecord): Worker {
  return {
    workerId: record._id,
    fullName: record.fullName,
    trade: record.trade,
    certifications: record.certifications.map((certification) => ({
      type: certification.type,
      issuedAt: certification.issuedAt.toISOString(),
      expiresAt: certification.expiresAt.toISOString(),
    })),
  };
}

export function toWorkerSummary(record: WorkerRecord): WorkerSummary {
  return { workerId: record._id, fullName: record.fullName };
}

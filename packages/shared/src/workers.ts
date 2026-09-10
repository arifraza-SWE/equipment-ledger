import type { CertificationType } from './assets';

export interface WorkerCertification {
  type: CertificationType;
  issuedAt: string;
  expiresAt: string;
}

export interface Worker {
  workerId: string;
  fullName: string;
  trade: string;
  certifications: WorkerCertification[];
}

export interface Keeper {
  keeperId: string;
  fullName: string;
}

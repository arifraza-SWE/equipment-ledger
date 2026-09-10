export const ASSET_KINDS = [
  'harness',
  'gas_detector',
  'cordless_drill',
  'angle_grinder',
  'ladder',
  'laser_level',
  'mobile_tower',
  'cut_off_saw',
  'two_way_radio',
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  harness: 'Safety harness',
  gas_detector: 'Gas detector',
  cordless_drill: 'Cordless drill',
  angle_grinder: 'Angle grinder',
  ladder: 'Ladder',
  laser_level: 'Laser level',
  mobile_tower: 'Mobile tower',
  cut_off_saw: 'Cut-off saw',
  two_way_radio: 'Two-way radio',
};

export const CERTIFICATION_TYPES = [
  'working_at_height',
  'gas_detection',
  'abrasive_wheels',
  'mobile_tower',
] as const;

export type CertificationType = (typeof CERTIFICATION_TYPES)[number];

export const CERTIFICATION_LABELS: Record<CertificationType, string> = {
  working_at_height: 'Working at Height',
  gas_detection: 'Gas Detection',
  abrasive_wheels: 'Abrasive Wheels',
  mobile_tower: 'Mobile Tower (PASMA)',
};

export const SERVICE_STATUSES = ['in_service', 'out_of_service'] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export interface Asset {
  assetId: string;
  kind: AssetKind;
  description: string;
  requiredCertification: CertificationType | null;
  registeredAt: string;
}

export const ASSET_STATUSES = [
  'in_store',
  'reserved',
  'issued',
  'overdue',
  'out_of_service',
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  in_store: 'In store',
  reserved: 'Reserved',
  issued: 'Issued',
  overdue: 'Overdue',
  out_of_service: 'Out of service',
};

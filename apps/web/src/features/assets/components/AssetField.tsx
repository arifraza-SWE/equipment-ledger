import {
  ASSET_KIND_LABELS,
  ASSET_KINDS,
  CERTIFICATION_LABELS,
  type AssetSnapshot,
} from '@equipment-ledger/shared';
import { Field } from '@/components/Field';
import formStyles from '@/components/Form.module.css';

interface AssetFieldProps {
  label: string;
  assets: AssetSnapshot[];
  value: string;
  onChange: (assetId: string) => void;
  describeOption?: (snapshot: AssetSnapshot) => string;
  /**
   * Why this asset cannot be chosen, or null if it can. Assets that cannot be chosen stay in the
   * list, greyed out and carrying the reason: a keeper hunting for one needs to find out that it
   * is out of service, not that it has vanished.
   */
  unavailableReason?: (snapshot: AssetSnapshot) => string | null;
  hint?: React.ReactNode;
  error?: string | null;
}

export function AssetField({
  label,
  assets,
  value,
  onChange,
  describeOption = describeAssetOption,
  unavailableReason,
  hint,
  error,
}: AssetFieldProps) {
  const kindsPresent = ASSET_KINDS.filter((kind) =>
    assets.some((snapshot) => snapshot.asset.kind === kind),
  );

  return (
    <Field label={label} hint={hint} error={error}>
      {(control) => (
        <select
          id={control.id}
          className={formStyles.control}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={control.describedBy}
          aria-invalid={control.invalid || undefined}
        >
          <option value="">{assets.length === 0 ? 'None available' : 'Choose asset'}</option>
          {kindsPresent.map((kind) => (
            <optgroup key={kind} label={ASSET_KIND_LABELS[kind]}>
              {assets
                .filter((snapshot) => snapshot.asset.kind === kind)
                .map((snapshot) => {
                  const reason = unavailableReason?.(snapshot) ?? null;
                  return (
                    <option
                      key={snapshot.asset.assetId}
                      value={snapshot.asset.assetId}
                      disabled={reason !== null}
                    >
                      {describeOption(snapshot)}
                      {reason === null ? '' : ` · ${reason}`}
                    </option>
                  );
                })}
            </optgroup>
          ))}
        </select>
      )}
    </Field>
  );
}

export function describeAssetOption(snapshot: AssetSnapshot): string {
  const { asset } = snapshot;
  const certificate = asset.requiredCertification
    ? ` · needs ${CERTIFICATION_LABELS[asset.requiredCertification]}`
    : '';
  return `${asset.assetId} · ${asset.description}${certificate}`;
}

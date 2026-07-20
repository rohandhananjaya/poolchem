import type { PackageFeatures } from "@/lib/package-features"

function FeatureCheckbox({
  name,
  label,
  defaultChecked,
}: {
  name: string
  label: string
  defaultChecked?: boolean
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-3.5 accent-teal-600" />
      {label}
    </label>
  )
}

export function PackageFeatureFields({
  prefix = "features",
  features,
}: {
  prefix?: string
  features?: PackageFeatures
}) {
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
        Features
      </summary>
      <div className="mt-2 space-y-1.5">
        <FeatureCheckbox
          name={`${prefix}.chemical_recs`}
          label="Chemical Recs"
          defaultChecked={features?.chemical_recs}
        />
        <FeatureCheckbox
          name={`${prefix}.service_reports`}
          label="Service Reports"
          defaultChecked={features?.service_reports}
        />
        <FeatureCheckbox
          name={`${prefix}.qr_code`}
          label="QR Code"
          defaultChecked={features?.qr_code}
        />
        <FeatureCheckbox
          name={`${prefix}.scheduling`}
          label="Scheduling"
          defaultChecked={features?.scheduling}
        />
        <FeatureCheckbox
          name={`${prefix}.multi_tech`}
          label="Multi Tech"
          defaultChecked={features?.multi_tech}
        />
        <FeatureCheckbox
          name={`${prefix}.priority_support`}
          label="Priority Support"
          defaultChecked={features?.priority_support}
        />
        <FeatureCheckbox
          name={`${prefix}.custom_branding`}
          label="Custom Branding"
          defaultChecked={features?.custom_branding}
        />
        <FeatureCheckbox
          name={`${prefix}.api_access`}
          label="API Access"
          defaultChecked={features?.api_access}
        />
        <FeatureCheckbox
          name={`${prefix}.csv_import`}
          label="CSV Import"
          defaultChecked={features?.csv_import}
        />
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Max Pools</label>
          <input
            name={`${prefix}.max_pools`}
            type="number"
            defaultValue={features?.max_pools ?? 5}
            className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Health Scoring</label>
          <select
            name={`${prefix}.health_scoring`}
            defaultValue={features?.health_scoring ?? "basic"}
            className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="basic">Basic</option>
            <option value="advanced+lsi">Advanced + LSI</option>
          </select>
        </div>
      </div>
    </details>
  )
}

// Core Domain Types for VulnBeacon

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type WebhookPlatform = 'discord' | 'telegram' | 'slack';

export type SyncStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';

export interface Vendor {
  id: string;
  code: string;
  name: string;
  icon_url?: string;
  homepage?: string;
  is_active: boolean;
  created_at: string;
  // Optional: pre-existing Vendor fixtures across the test suite predate the
  // scheduler and do not set these; VendorService.fetchVendors applies the
  // runtime defaults described in the spec.
  schedule_enabled?: boolean;
  schedule_times?: string[];
  schedule_timezone?: string;
  last_scheduled_run_at?: string | null;
}

export interface Advisory {
  id: string;
  vendor_id: string;
  advisory_id: string;
  title: string;
  severity: SeverityLevel;
  published_at: string;
  updated_at?: string;
  url: string;
  summary?: string;
  raw_payload?: Record<string, unknown>;
  created_at: string;
}

export interface CveRecord {
  id: string;
  cve_id: string;
  description: string;
  cvss_v3_score?: number | null;
  cvss_v3_vector?: string | null;
  severity: SeverityLevel;
  is_known_exploited: boolean;
  published_date?: string;
  last_modified_date?: string;
  created_at: string;
}

export interface ProductImpactItem {
  product_name: string;
  component: string;
  state: string; // e.g. 'Affected', 'Fix deferred', 'Under investigation', 'Will not fix', 'Not affected', 'Fixed'
  justification?: string;
  errata?: string;
  release_date?: string;
  cpe?: string;
}

export interface SecurityFixItem {
  cve_id: string;
  component?: string;
  summary: string;
  bugzilla_id?: string;
  bugzilla_url?: string;
}

export interface UpdatedPackageItem {
  package_name: string;
  architecture?: string;
  version?: string;
  product?: string;
  advisory?: string;
  release_date?: string;
}

export interface AdvisoryDetailData {
  advisory_id: string;
  synopsis?: string;
  type_severity?: string;
  topic?: string;
  description?: string;
  solution?: string;
  mitigation?: string;
  statement?: string;
  affected_products?: string[];
  security_fixes?: SecurityFixItem[];
  updated_packages?: UpdatedPackageItem[];
  cves?: string[];
  url?: string;
  issued_date?: string;
  updated_date?: string;
}

export interface AdvisoryCveMap {
  id: string;
  advisory_id: string;
  cve_id: string;
  affected_products: string[];
  product_impacts?: ProductImpactItem[];
  fixed_versions: string[];
  created_at: string;
}

export interface VendorSyncLog {
  id: string;
  vendor_id?: string | null;
  vendor_code?: string;
  status: SyncStatus;
  items_fetched: number;
  new_items_count: number;
  error_message?: string | null;
  duration_ms?: number | null;
  started_at: string;
  finished_at?: string | null;
}

export interface WebhookConfig {
  id: string;
  name: string;
  platform: WebhookPlatform;
  webhook_url: string;
  min_severity: SeverityLevel;
  is_active: boolean;
  created_at: string;
}

export interface NormalizedAdvisoryItem {
  advisoryId: string;
  title: string;
  severity: SeverityLevel;
  publishedAt: string;
  updatedAt?: string;
  url: string;
  summary?: string;
  solution?: string;
  topic?: string;
  mitigation?: string;
  statement?: string;
  securityFixes?: SecurityFixItem[];
  updatedPackages?: UpdatedPackageItem[];
  cves: {
    cveId: string;
    description?: string;
    cvssScore?: number;
    cvssVector?: string;
    severity?: SeverityLevel;
    affectedProducts?: string[];
    productImpacts?: ProductImpactItem[];
    fixedVersions?: string[];
    solution?: string;
  }[];
  rawPayload?: Record<string, unknown>;
}

export interface VendorEndpoint {
  /** Short human label, e.g. 'Advisory list'. */
  label: string;
  /** The URL actually requested. Placeholders in braces mark per-request values. */
  url: string;
}

export interface VendorAdapter {
  readonly vendorCode: string;
  readonly vendorName: string;
  readonly endpoints: VendorEndpoint[];
  fetchAdvisories(): Promise<NormalizedAdvisoryItem[]>;
  parse(rawPayload: unknown): NormalizedAdvisoryItem[];
}

export interface WebhookAlertPayload {
  vendorName: string;
  advisoryId: string;
  advisoryTitle: string;
  advisoryUrl: string;
  cveId: string;
  cvssScore?: number | null;
  severity: SeverityLevel;
  summary?: string;
  solution?: string;
  affectedProducts?: string[];
  productImpacts?: ProductImpactItem[];
  fixedVersions?: string[];
  dashboardUrl?: string;
}

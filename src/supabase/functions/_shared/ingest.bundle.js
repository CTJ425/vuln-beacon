// utils/cvss.ts
function normalizeSeverity(severityStr) {
  if (!severityStr) return "UNKNOWN";
  const clean = severityStr.trim().toUpperCase();
  if (clean === "CRITICAL" || clean === "CRIT") return "CRITICAL";
  if (clean === "HIGH" || clean === "IMPORTANT" || clean === "SEVERE") return "HIGH";
  if (clean === "MEDIUM" || clean === "MODERATE" || clean === "MED") return "MEDIUM";
  if (clean === "LOW" || clean === "MINOR") return "LOW";
  return "UNKNOWN";
}

// adapters/redhat-csaf.ts
var STATE_LABELS = {
  fixed: "Fixed",
  known_affected: "Affected",
  known_not_affected: "Not affected",
  under_investigation: "Under investigation"
};
function labelForState(key) {
  if (STATE_LABELS[key]) return STATE_LABELS[key];
  return key.split("_").map((word, idx) => idx === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(" ");
}
function indexProductNames(nodes, index) {
  if (!nodes) return;
  for (const node of nodes) {
    if (node.category === "product_name" && node.product?.product_id && node.product?.name) {
      index.set(node.product.product_id, node.product.name);
    }
    if (node.branches) {
      indexProductNames(node.branches, index);
    }
  }
}
var LANGPACK_RE = /^(.+)-langpack-[a-zA-Z]+(?:_[a-zA-Z]+)?$/;
function collapseLocalePackages(productImpacts) {
  const result = [];
  const families = /* @__PURE__ */ new Map();
  for (const item of productImpacts) {
    const match = item.component.match(LANGPACK_RE);
    if (!match) {
      result.push(item);
      continue;
    }
    const base = match[1];
    const familyKey = `${item.product_name}|${item.state}|${base}-langpack`;
    let family = families.get(familyKey);
    if (!family) {
      family = { base, members: /* @__PURE__ */ new Map() };
      families.set(familyKey, family);
    }
    if (!family.members.has(item.component)) {
      family.members.set(item.component, item);
    }
  }
  for (const family of families.values()) {
    const first = family.members.values().next().value;
    const count = family.members.size;
    result.push({
      ...first,
      component: `${family.base}-langpack-* (${count} \u500B\u8A9E\u7CFB)`
    });
  }
  return result;
}
function componentFromNvr(nvr) {
  const digestMatch = nvr.match(/@sha256:/i);
  if (digestMatch && digestMatch.index !== void 0) {
    return nvr.slice(0, digestMatch.index);
  }
  const match = nvr.match(/-\d+:/);
  if (!match || match.index === void 0) return nvr;
  return nvr.slice(0, match.index);
}
var RedHatCsafAdapter = class {
  vendorCode = "redhat";
  vendorName = "Red Hat";
  listUrl = "https://access.redhat.com/hydra/rest/securitydata/csaf.json";
  detailUrlBase = "https://access.redhat.com/hydra/rest/securitydata/csaf";
  endpoints = [
    { label: "Advisory list (CSAF)", url: `${this.listUrl}?per_page=50` },
    { label: "Advisory detail (CSAF)", url: `${this.detailUrlBase}/{advisoryId}.json` },
    { label: "CVE reverse lookup", url: `${this.listUrl}?cve={cveId}` }
  ];
  advisoryDetailUrl(advisoryId) {
    return `${this.detailUrlBase}/${advisoryId}.json`;
  }
  cveLookupUrl(cveId) {
    return `${this.listUrl}?cve=${cveId}`;
  }
  async fetchAdvisories() {
    const response = await fetch(`${this.listUrl}?per_page=50`);
    if (!response.ok) {
      throw new Error(`Failed to fetch Red Hat CSAF advisories: ${response.statusText}`);
    }
    const list = await response.json();
    if (!Array.isArray(list)) return [];
    const detailDocuments = (await Promise.all(
      list.map(async (entry) => {
        if (!entry.RHSA) return null;
        try {
          const detailRes = await fetch(this.advisoryDetailUrl(entry.RHSA));
          if (detailRes.ok) {
            return await detailRes.json();
          }
        } catch {
        }
        return null;
      })
    )).filter((doc) => doc !== null);
    return this.parse(detailDocuments);
  }
  parse(rawPayload) {
    if (!Array.isArray(rawPayload)) {
      return [];
    }
    const items = [];
    for (const doc of rawPayload) {
      const advisoryId = doc?.document?.tracking?.id;
      const vulnerabilities = doc?.vulnerabilities;
      if (!advisoryId || !Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
        continue;
      }
      const document = doc.document;
      const notes = document.notes || [];
      const rawTitle = document.title || "";
      const title = rawTitle.replace(
        /^Red Hat (Security|Bug Fix|Enhancement) Advisory: /,
        ""
      );
      const severity = normalizeSeverity(document.aggregate_severity?.text);
      const publishedAt = document.tracking?.initial_release_date || "";
      const updatedAt = document.tracking?.current_release_date;
      const url = `https://access.redhat.com/errata/${advisoryId}`;
      const summaryText = notes.find((n) => n.category === "summary")?.text;
      const summary = summaryText;
      const topic = summaryText;
      const statement = notes.find((n) => n.category === "general")?.text;
      let solution;
      let mitigation;
      for (const vuln of vulnerabilities) {
        if (!solution) {
          const vendorFix = vuln.remediations?.find((r) => r.category === "vendor_fix");
          if (vendorFix?.details) solution = vendorFix.details;
        }
        if (!mitigation) {
          const workaround = vuln.remediations?.find((r) => r.category === "workaround");
          if (workaround?.details) mitigation = workaround.details;
        }
        if (solution && mitigation) break;
      }
      const productNameIndex = /* @__PURE__ */ new Map();
      indexProductNames(doc.product_tree?.branches, productNameIndex);
      const cves = vulnerabilities.map((vuln) => {
        const cveId = vuln.cve || "";
        const description = vuln.notes?.find((n) => n.category === "description")?.text || vuln.title;
        const primaryScore = vuln.scores?.[0]?.cvss_v3;
        const cvssScore = primaryScore?.baseScore;
        const cvssVector = primaryScore?.vectorString;
        const impactDetails = vuln.threats?.find((t) => t.category === "impact")?.details;
        const cveSeverity = impactDetails ? normalizeSeverity(impactDetails) : primaryScore?.baseSeverity ? normalizeSeverity(primaryScore.baseSeverity) : severity;
        const productImpacts = [];
        const seenKeys = /* @__PURE__ */ new Set();
        const productStatus = vuln.product_status || {};
        for (const [stateKey, compositeIds] of Object.entries(productStatus)) {
          if (!Array.isArray(compositeIds)) continue;
          const state = labelForState(stateKey);
          for (const compositeId of compositeIds) {
            const sepIdx = compositeId.indexOf(":");
            if (sepIdx === -1) continue;
            const branchId = compositeId.slice(0, sepIdx);
            const nvr = compositeId.slice(sepIdx + 1);
            const productName = productNameIndex.get(branchId) || branchId;
            const component = componentFromNvr(nvr);
            if (component.endsWith("-debuginfo") || component.endsWith("-debugsource")) {
              continue;
            }
            const key = `${productName}|${component}|${state}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            productImpacts.push({
              product_name: productName,
              component,
              state,
              justification: "None",
              errata: advisoryId,
              release_date: document.tracking?.initial_release_date
            });
          }
        }
        const collapsedProductImpacts = collapseLocalePackages(productImpacts);
        const affectedProducts = Array.from(
          new Set(collapsedProductImpacts.map((p) => p.product_name))
        );
        return {
          cveId,
          description,
          cvssScore: cvssScore ?? void 0,
          cvssVector,
          severity: cveSeverity,
          fixedVersions: [`Released in ${advisoryId}`],
          solution,
          productImpacts: collapsedProductImpacts,
          affectedProducts
        };
      });
      const allCveIds = cves.map((c) => c.cveId);
      items.push({
        advisoryId,
        title,
        severity,
        publishedAt,
        updatedAt,
        url,
        summary,
        topic,
        solution,
        mitigation,
        statement,
        cves,
        rawPayload: {
          csaf_document_id: advisoryId,
          cve_ids: allCveIds
        }
      });
    }
    return items;
  }
};

// adapters/index.ts
var ALL_ADAPTERS = [
  new RedHatCsafAdapter()
];
var seenVendorCodes = /* @__PURE__ */ new Set();
for (const adapter of ALL_ADAPTERS) {
  if (seenVendorCodes.has(adapter.vendorCode)) {
    throw new Error(`Duplicate vendorCode registration in ALL_ADAPTERS: '${adapter.vendorCode}'`);
  }
  seenVendorCodes.add(adapter.vendorCode);
}
function getAdapterByCode(code) {
  return ALL_ADAPTERS.find((a) => a.vendorCode === code.toLowerCase());
}

// engine/ingestion.ts
var IngestionEngine = class {
  advisories = /* @__PURE__ */ new Map();
  cves = /* @__PURE__ */ new Map();
  mappings = [];
  syncLogs = [];
  webhookService;
  knownCveIds;
  constructor(options) {
    this.webhookService = options?.webhookService;
    this.knownCveIds = new Set(options?.knownCveIds ?? []);
  }
  async ingestVendor(vendorCode, rawPayload) {
    const startTime = Date.now();
    const adapter = getAdapterByCode(vendorCode);
    if (!adapter) {
      const durationMs = Date.now() - startTime;
      const log = {
        id: `log-${Date.now()}`,
        vendor_code: vendorCode,
        status: "FAILED",
        items_fetched: 0,
        new_items_count: 0,
        error_message: `Unknown vendor adapter code: ${vendorCode}`,
        duration_ms: durationMs,
        started_at: new Date(startTime).toISOString(),
        finished_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.syncLogs.push(log);
      return {
        vendorCode,
        status: "FAILED",
        advisoriesCount: 0,
        cvesCount: 0,
        newCvesCount: 0,
        durationMs,
        errorMessage: log.error_message || void 0
      };
    }
    try {
      const items = rawPayload !== void 0 ? adapter.parse(rawPayload) : await adapter.fetchAdvisories();
      let newCvesCount = 0;
      let totalCves = 0;
      const pendingAlerts = [];
      for (const item of items) {
        const advKey = `${vendorCode}:${item.advisoryId}`;
        const advisoryRecord = {
          id: `adv-${advKey}`,
          vendor_id: vendorCode,
          advisory_id: item.advisoryId,
          title: item.title,
          severity: item.severity,
          published_at: item.publishedAt,
          updated_at: item.updatedAt,
          url: item.url,
          summary: item.summary,
          raw_payload: item.rawPayload,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.advisories.set(advKey, advisoryRecord);
        for (const cve of item.cves) {
          totalCves++;
          const cveKey = cve.cveId;
          const isNew = !this.cves.has(cveKey);
          const isTrulyNew = isNew && !this.knownCveIds.has(cveKey);
          if (isTrulyNew) newCvesCount++;
          const cveRecord = {
            id: `cve-${cveKey}`,
            cve_id: cve.cveId,
            description: cve.description || item.title,
            cvss_v3_score: cve.cvssScore ?? null,
            cvss_v3_vector: cve.cvssVector ?? null,
            severity: cve.severity || item.severity,
            is_known_exploited: false,
            published_date: item.publishedAt,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          this.cves.set(cveKey, cveRecord);
          this.mappings.push({
            id: `map-${advKey}-${cveKey}`,
            advisory_id: advisoryRecord.id,
            cve_id: cveRecord.id,
            affected_products: cve.affectedProducts || [],
            product_impacts: cve.productImpacts || [],
            fixed_versions: cve.fixedVersions || [],
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          if (this.webhookService && isTrulyNew && (cveRecord.severity === "CRITICAL" || cveRecord.severity === "HIGH")) {
            pendingAlerts.push({
              vendorName: adapter.vendorName,
              advisoryId: item.advisoryId,
              advisoryTitle: item.title,
              advisoryUrl: item.url,
              cveId: cve.cveId,
              cvssScore: cve.cvssScore,
              severity: cveRecord.severity,
              summary: cve.description || item.summary,
              affectedProducts: cve.affectedProducts,
              fixedVersions: cve.fixedVersions
            });
          }
        }
      }
      if (this.webhookService && pendingAlerts.length > 0) {
        await Promise.allSettled(pendingAlerts.map((alert) => this.webhookService.notifyAll(alert)));
      }
      const durationMs = Date.now() - startTime;
      const log = {
        id: `log-${Date.now()}`,
        vendor_code: vendorCode,
        status: "SUCCESS",
        items_fetched: items.length,
        new_items_count: newCvesCount,
        duration_ms: durationMs,
        started_at: new Date(startTime).toISOString(),
        finished_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.syncLogs.push(log);
      return {
        vendorCode,
        status: "SUCCESS",
        advisoriesCount: items.length,
        cvesCount: totalCves,
        newCvesCount,
        durationMs
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const message = err instanceof Error ? err.message : "Unknown error during ingestion";
      const log = {
        id: `log-${Date.now()}`,
        vendor_code: vendorCode,
        status: "FAILED",
        items_fetched: 0,
        new_items_count: 0,
        error_message: message,
        duration_ms: durationMs,
        started_at: new Date(startTime).toISOString(),
        finished_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.syncLogs.push(log);
      return {
        vendorCode,
        status: "FAILED",
        advisoriesCount: 0,
        cvesCount: 0,
        newCvesCount: 0,
        durationMs,
        errorMessage: message
      };
    }
  }
  getAdvisories() {
    return Array.from(this.advisories.values());
  }
  getCves() {
    return Array.from(this.cves.values());
  }
  getMappings() {
    return [...this.mappings];
  }
  getSyncLogs() {
    return [...this.syncLogs];
  }
};

// services/scheduleWindow.ts
var SCHEDULE_TICK_TOLERANCE_MINUTES = 10;
function zonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const map = {};
  for (const part of parts) map[part.type] = part.value;
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}
function timeZoneOffsetMs(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(new Date(utcMs));
  const map = {};
  for (const part of parts) map[part.type] = part.value;
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - utcMs;
}
function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess - offset);
}
function dueOccurrence(state, now) {
  if (!state.schedule_enabled || !state.schedule_times || state.schedule_times.length === 0) {
    return null;
  }
  let candidates;
  try {
    const today = zonedDateParts(now, state.schedule_timezone);
    const yesterdayUtc = new Date(Date.UTC(today.year, today.month - 1, today.day - 1));
    const yesterday = {
      year: yesterdayUtc.getUTCFullYear(),
      month: yesterdayUtc.getUTCMonth() + 1,
      day: yesterdayUtc.getUTCDate()
    };
    candidates = state.schedule_times.flatMap((hhmm) => {
      const [hour, minute] = hhmm.split(":").map(Number);
      return [
        zonedTimeToUtc(today.year, today.month, today.day, hour, minute, state.schedule_timezone),
        zonedTimeToUtc(yesterday.year, yesterday.month, yesterday.day, hour, minute, state.schedule_timezone)
      ];
    });
  } catch {
    return null;
  }
  const past = candidates.filter((candidate) => candidate.getTime() <= now.getTime());
  if (past.length === 0) return null;
  const latest = past.reduce((a, b) => b.getTime() > a.getTime() ? b : a);
  const ageMinutes = (now.getTime() - latest.getTime()) / 6e4;
  if (ageMinutes > SCHEDULE_TICK_TOLERANCE_MINUTES) return null;
  if (state.last_scheduled_run_at) {
    const lastRun = new Date(state.last_scheduled_run_at);
    if (lastRun.getTime() >= latest.getTime()) return null;
  }
  return latest;
}
function isVendorDue(state, now) {
  return dueOccurrence(state, now) !== null;
}

// formatters/discord.ts
var SEVERITY_COLORS = {
  CRITICAL: 13840175,
  // Red
  HIGH: 16088064,
  // Orange
  MEDIUM: 16498733,
  // Yellow
  LOW: 3706428,
  // Green
  UNKNOWN: 7697781
  // Grey
};
function formatDiscordAlert(alert) {
  const color = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.UNKNOWN;
  const scoreText = alert.cvssScore ? `${alert.cvssScore} (${alert.severity})` : alert.severity;
  const fields = [
    { name: "Vendor", value: alert.vendorName, inline: true },
    { name: "Advisory ID", value: alert.advisoryId, inline: true },
    { name: "CVSS Score", value: scoreText, inline: true }
  ];
  if (alert.affectedProducts && alert.affectedProducts.length > 0) {
    fields.push({
      name: "Affected Products",
      value: alert.affectedProducts.slice(0, 5).join("\n"),
      inline: false
    });
  }
  if (alert.fixedVersions && alert.fixedVersions.length > 0) {
    fields.push({
      name: "Fixed In",
      value: alert.fixedVersions.slice(0, 5).join("\n"),
      inline: false
    });
  }
  return {
    embeds: [
      {
        title: `\u{1F6A8} [${alert.severity}] Security Alert: ${alert.cveId}`,
        description: alert.summary || alert.advisoryTitle,
        url: alert.advisoryUrl,
        color,
        fields,
        footer: {
          text: "VulnBeacon \u2022 Automated Multi-Vendor CVE Intel"
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    ]
  };
}

// formatters/telegram.ts
function formatTelegramAlert(alert) {
  const scoreText = alert.cvssScore ? `${alert.cvssScore} (${alert.severity})` : alert.severity;
  const products = (alert.affectedProducts || []).slice(0, 3).join(", ") || "N/A";
  const text = [
    `\u{1F6A8} <b>[${alert.severity} Security Alert]</b>`,
    ``,
    `<b>CVE:</b> <code>${alert.cveId}</code>`,
    `<b>Vendor:</b> ${alert.vendorName}`,
    `<b>Advisory:</b> <a href="${alert.advisoryUrl}">${alert.advisoryId}</a>`,
    `<b>CVSS Score:</b> ${scoreText}`,
    `<b>Affected:</b> ${products}`,
    ``,
    `<b>Summary:</b> ${alert.summary || alert.advisoryTitle}`,
    alert.dashboardUrl ? `
\u{1F517} <a href="${alert.dashboardUrl}">Open in VulnBeacon Dashboard</a>` : ""
  ].filter(Boolean).join("\n");
  return {
    text,
    parse_mode: "HTML",
    disable_web_page_preview: false
  };
}

// formatters/slack.ts
function formatSlackAlert(alert) {
  const scoreText = alert.cvssScore ? `${alert.cvssScore} (${alert.severity})` : alert.severity;
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `\u{1F6A8} [${alert.severity}] Security Alert: ${alert.cveId}`,
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Vendor:*
${alert.vendorName}`
        },
        {
          type: "mrkdwn",
          text: `*Advisory ID:*
<${alert.advisoryUrl}|${alert.advisoryId}>`
        },
        {
          type: "mrkdwn",
          text: `*Severity:*
${scoreText}`
        },
        {
          type: "mrkdwn",
          text: `*CVE ID:*
${alert.cveId}`
        }
      ]
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Summary:*
${alert.summary || alert.advisoryTitle}`
      }
    }
  ];
  if (alert.dashboardUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "\u{1F6E1}\uFE0F Triage in VulnBeacon",
            emoji: true
          },
          url: alert.dashboardUrl,
          style: alert.severity === "CRITICAL" ? "danger" : "primary"
        }
      ]
    });
  }
  return { blocks };
}

// formatters/index.ts
function formatWebhookAlert(platform, payload) {
  switch (platform) {
    case "discord":
      return formatDiscordAlert(payload);
    case "telegram":
      return formatTelegramAlert(payload);
    case "slack":
      return formatSlackAlert(payload);
    default:
      throw new Error(`Unsupported webhook platform: ${platform}`);
  }
}

// services/webhook.ts
var SEVERITY_RANKS = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0
};
var WebhookService = class {
  webhooks = [];
  registerWebhook(config) {
    this.webhooks.push(config);
  }
  clearWebhooks() {
    this.webhooks = [];
  }
  getWebhooks() {
    return [...this.webhooks];
  }
  async dispatch(config, alert, { ignoreActiveState = false } = {}) {
    const minRank = SEVERITY_RANKS[config.min_severity] || 0;
    const alertRank = SEVERITY_RANKS[alert.severity] || 0;
    if (alertRank < minRank || !config.is_active && !ignoreActiveState) {
      return false;
    }
    const payload = formatWebhookAlert(config.platform, alert);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1e4);
    try {
      const response = await fetch(config.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      return response.ok;
    } catch (err) {
      console.warn("Webhook dispatch failed:", config.id, config.platform, err);
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  async notifyAll(alert) {
    const results = await Promise.allSettled(
      this.webhooks.map((hook) => this.dispatch(hook, alert))
    );
    return results.filter((r) => r.status === "fulfilled" && r.value).length;
  }
};
export {
  IngestionEngine,
  SCHEDULE_TICK_TOLERANCE_MINUTES,
  WebhookService,
  getAdapterByCode,
  isVendorDue
};

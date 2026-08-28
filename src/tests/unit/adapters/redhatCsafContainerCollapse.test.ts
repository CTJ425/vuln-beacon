import { describe, it, expect } from 'vitest';
import { RedHatCsafAdapter } from '@/adapters/redhat-csaf';

/**
 * BUG-003 cause 1. Red Hat CSAF product ids for container images carry a
 * per-architecture image digest, e.g.
 *   registry.redhat.io/openshift4/ose-hypershift-rhel9@sha256:<64 hex>_arm64
 * componentFromNvr() only cuts NVRs at "-<digits>:", so every digest and every
 * architecture stayed a distinct component and the existing seenKeys dedupe
 * never fired. A live run emitted 132,982 impact rows, 131,206 of them digests
 * (99.1% of the payload bytes).
 */
const adapter = new RedHatCsafAdapter();

const DIGEST_A = 'sha256:24d0ef0bd22114f8402e58d52eb37ddcf484aac746d1858e6e38551c3ea602f6';
const DIGEST_B = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
const IMAGE = 'registry.redhat.io/openshift4/ose-hypershift-rhel9';

const doc = (fixedIds: string[]) => ({
  document: {
    aggregate_severity: { text: 'Important' },
    title: 'Red Hat Security Advisory: OpenShift update',
    notes: [{ category: 'summary', text: 'An update is available.', title: 'Topic' }],
    tracking: {
      id: 'RHSA-2099:0002',
      initial_release_date: '2099-01-01T00:00:00+00:00',
      current_release_date: '2099-01-02T00:00:00+00:00',
    },
  },
  product_tree: {
    branches: [
      {
        category: 'vendor',
        name: 'Red Hat',
        branches: [
          {
            category: 'product_family',
            name: 'Red Hat OpenShift Container Platform',
            branches: [
              {
                category: 'product_name',
                name: 'Red Hat OpenShift Container Platform 4.15',
                product: {
                  product_id: 'OCP-4.15',
                  name: 'Red Hat OpenShift Container Platform 4.15',
                },
              },
            ],
          },
        ],
      },
    ],
    relationships: [],
  },
  vulnerabilities: [
    {
      cve: 'CVE-2099-0002',
      notes: [{ category: 'description', text: 'A flaw was found.', title: 'Vulnerability description' }],
      product_status: { fixed: fixedIds },
      scores: [{ cvss_v3: { baseScore: 7.8, baseSeverity: 'HIGH', vectorString: 'CVSS:3.1/AV:L' } }],
      threats: [{ category: 'impact', details: 'Important' }],
      title: 'openshift: example flaw',
    },
  ],
});

const impactsOf = (fixedIds: string[]) => {
  const items = adapter.parse([doc(fixedIds)] as any);
  expect(items).toHaveLength(1);
  return items[0].cves[0].productImpacts ?? [];
};

describe('RedHatCsafAdapter collapses container image references (BUG-003)', () => {
  it('reduces a digest-pinned image to its repository path', () => {
    const impacts = impactsOf([`OCP-4.15:${IMAGE}@${DIGEST_A}_arm64`]);

    expect(impacts).toHaveLength(1);
    expect(impacts[0].component).toBe(IMAGE);
  });

  it('emits one row for the same image across several architectures', () => {
    const impacts = impactsOf([
      `OCP-4.15:${IMAGE}@${DIGEST_A}_amd64`,
      `OCP-4.15:${IMAGE}@${DIGEST_A}_arm64`,
      `OCP-4.15:${IMAGE}@${DIGEST_A}_s390x`,
    ]);

    expect(impacts).toHaveLength(1);
    expect(impacts[0].component).toBe(IMAGE);
  });

  it('emits one row for the same image published under two digests', () => {
    const impacts = impactsOf([
      `OCP-4.15:${IMAGE}@${DIGEST_A}_amd64`,
      `OCP-4.15:${IMAGE}@${DIGEST_B}_amd64`,
    ]);

    expect(impacts).toHaveLength(1);
    expect(impacts[0].component).toBe(IMAGE);
  });

  it('keeps distinct images distinct', () => {
    const other = 'registry.redhat.io/openshift4/ose-console-rhel9';
    const impacts = impactsOf([
      `OCP-4.15:${IMAGE}@${DIGEST_A}_amd64`,
      `OCP-4.15:${other}@${DIGEST_B}_amd64`,
    ]);

    expect(impacts.map((i) => i.component).sort()).toEqual([other, IMAGE].sort());
  });

  it('still collapses a plain NVR to its package name (no regression)', () => {
    const impacts = impactsOf(['OCP-4.15:glibc-0:2.28-225.el8_8.6.x86_64']);

    expect(impacts).toHaveLength(1);
    expect(impacts[0].component).toBe('glibc');
  });

  it('leaves a component with neither a digest nor an NVR epoch unchanged', () => {
    const impacts = impactsOf(['OCP-4.15:some-plain-component']);

    expect(impacts).toHaveLength(1);
    expect(impacts[0].component).toBe('some-plain-component');
  });
});

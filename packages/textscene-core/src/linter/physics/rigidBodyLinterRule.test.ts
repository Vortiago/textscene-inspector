/**
 * The contact-monitor arm, at the rule seam: `max_contacts_reported` is a
 * COUNT, and its default is 0 (`rigid_body_2d.h:85`, `rigid_body_3d.h:82`),
 * so a written 0 asks the server for no contacts and leaves nothing behind
 * the `if (contact_monitor)` guard to report.
 */

import { describe, expect, it } from 'vitest';
import { makeRigidBodyLinterRule } from './rigidBodyLinterRule.js';
import type { PhysicsDim } from './dim.js';
import type { TscnNode, TscnScene } from '../../parser/types.js';

function contactDiagnostics(dim: PhysicsDim, properties: Record<string, string>) {
  const node: TscnNode = {
    name: 'Body',
    type: `RigidBody${dim}`,
    properties,
    rawProperties: properties,
    children: [],
  };
  const scene: TscnScene = { nodes: [node], externalResources: [], internalResources: [] };
  return makeRigidBodyLinterRule(dim)
    .check({ scene, node, properties })
    .filter((d) => d.ruleName.endsWith('-max-contacts-without-monitor'));
}

describe.each<PhysicsDim>(['2D', '3D'])('RigidBody%s max_contacts_reported without contact_monitor', (dim) => {
  it('warns for a positive count', () => {
    expect(contactDiagnostics(dim, { max_contacts_reported: '10' })).toHaveLength(1);
  });

  it('stays silent on an explicit 0, the default', () => {
    expect(contactDiagnostics(dim, { max_contacts_reported: '0' })).toEqual([]);
  });

  it('stays silent on a count the INT slot cannot read', () => {
    expect(contactDiagnostics(dim, { max_contacts_reported: '"ten"' })).toEqual([]);
  });
});

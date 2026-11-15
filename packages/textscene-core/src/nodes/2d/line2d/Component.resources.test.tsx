/**
 * <Line2D> with a `gradient` and a `width_curve`: each resolves as a SubResource or as an
 * ExtResource `.tres` that may load late, and an unresolved one draws as if unset.
 */

import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Line2D } from './Component';
import { parseLine2D } from './parser';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../../resources/testing/createFakeResourceLoader';
import { parseTresFile } from '../../../parser/parsedResource';
import type { ParsedHeading } from '../../../parser/utils';
import type { TscnExternalResource, TscnInternalResource, TscnNode } from '../../../parser/types';

const GRADIENT: TscnInternalResource = {
  type: 'Gradient',
  id: 'ramp',
  data: { offsets: 'PackedFloat32Array(0, 1)', colors: 'PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)' },
};

/** A ramp from 0.25 at the start to 1 at the end. */
const RAMP: TscnInternalResource = {
  type: 'Curve',
  id: 'ramp',
  data: { _data: '[Vector2(0, 0.25), 0.0, 0.0, 0, 0, Vector2(1, 1), 0.0, 0.0, 0, 0]', point_count: '2' },
};

const GRADIENT_TRES = `[gd_resource type="Gradient" format=3]

[resource]
offsets = PackedFloat32Array(0, 1)
colors = PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)
`;

function lineNode(rawProps: Record<string, string>): TscnNode {
  const heading: ParsedHeading = { type: 'node', attributes: { name: 'Line', type: 'Line2D' } };
  return {
    rawProperties: {},
    name: 'Line',
    type: 'Line2D',
    children: [],
    properties: parseLine2D(heading, {
      points: 'PackedVector2Array(0, 0, 100, 0)',
      width: '40.0',
      ...rawProps,
    }),
  };
}

function render(
  rawProps: Record<string, string>,
  resources: {
    internal?: TscnInternalResource[];
    external?: TscnExternalResource[];
    fake?: FakeResourceLoader;
  } = {}
) {
  const fake = resources.fake ?? createFakeResourceLoader();
  return ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={resources.internal ?? []}
          externalResources={resources.external ?? []}
        >
          <Line2D node={lineNode(rawProps)} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
}

type Rendered = Awaited<ReturnType<typeof render>>;

function strokeMesh(rendered: Rendered): THREE.Mesh | undefined {
  return rendered.scene.findAllByType('Mesh').map((o) => o.instance as THREE.Mesh)[0];
}

describe('<Line2D> gradient', () => {
  it('colours the vertices from a gradient sub-resource, first stop to last', async () => {
    const mesh = strokeMesh(await render({ gradient: 'SubResource("ramp")' }, { internal: [GRADIENT] }))!;
    const color = mesh.geometry.getAttribute('color');
    expect(color.itemSize).toBe(4);
    expect([color.getX(0), color.getZ(0)]).toEqual([1, 0]);
    expect([color.getX(3), color.getZ(3)]).toEqual([0, 1]);
  });

  it('ignores default_color when a gradient is set', async () => {
    const rendered = await render(
      { gradient: 'SubResource("ramp")', default_color: 'Color(1, 0, 0, 1)' },
      { internal: [GRADIENT] }
    );
    const material = strokeMesh(rendered)!.material as THREE.MeshBasicMaterial;
    expect(material.vertexColors).toBe(true);
    expect([material.color.r, material.color.g, material.color.b]).toEqual([1, 1, 1]);
  });

  it('draws as if unset for a reference that names no resource', async () => {
    const mesh = strokeMesh(await render({ gradient: 'SubResource("missing")' }))!;
    expect(mesh.geometry.hasAttribute('color')).toBe(false);
  });

  it('draws as if unset until an ExtResource .tres loads, then redraws with its colours', async () => {
    const fake = createFakeResourceLoader();
    const rendered = await render(
      { gradient: 'ExtResource("1")' },
      { external: [{ id: '1', type: 'Gradient', path: 'res://ramp.tres' }], fake }
    );
    expect(strokeMesh(rendered)!.geometry.hasAttribute('color')).toBe(false);

    await ReactThreeTestRenderer.act(async () => {
      fake.resources._resolve('res://ramp.tres', parseTresFile(GRADIENT_TRES));
    });
    expect(strokeMesh(rendered)!.geometry.hasAttribute('color')).toBe(true);
  });
});

describe('<Line2D> width_curve', () => {
  /** The Y span of the two vertices at the start of the strip. */
  const startSpan = (mesh: THREE.Mesh) => {
    const position = mesh.geometry.getAttribute('position');
    return Math.abs(position.getY(0) - position.getY(1));
  };

  it('narrows the start of the stroke to the curve sample', async () => {
    const mesh = strokeMesh(await render({ width_curve: 'SubResource("ramp")' }, { internal: [RAMP] }))!;
    expect(startSpan(mesh)).toBeCloseTo(40 * 0.25, 5);
  });

  it('draws the full width for a reference that names no resource', async () => {
    const mesh = strokeMesh(await render({ width_curve: 'SubResource("missing")' }))!;
    expect(startSpan(mesh)).toBeCloseTo(40, 5);
  });
});

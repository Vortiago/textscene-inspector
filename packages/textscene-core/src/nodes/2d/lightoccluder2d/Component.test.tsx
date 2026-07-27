/**
 * <LightOccluder2D> component tests — topology, gizmo gate, absent resource,
 * and publication to the shadow-caster registry.
 *
 * Mirrors the contract in the Behavioral Contract (lightoccluder2d-contract.test.tsx)
 * but is standalone: no imports from the contract test file.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Linter } from '../../../linter/Linter';
import { TscnParser } from '../../../parser/TscnParser';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { SelectionProvider } from '../../../r3f/contexts/SelectionContext';
import {
  createShadowCasterRegistry,
  ShadowCasterProvider,
  worldShadowCasters,
} from '../../../r3f/lighting2d/shadowCasterRegistry';
import {
  OCCLUDER_CULL_CLOCKWISE,
  OCCLUDER_CULL_COUNTER_CLOCKWISE,
  OCCLUDER_CULL_DISABLED,
} from '../../../r3f/lighting2d/shadowVolumes';
import { fixturesDir } from '../../../parser/testing/parserKit';
import { parseOccluderCullMode, polygonToSegments } from './polygonShapes';

// Import the slice's self-registration side effects.
import '../../2d/lightoccluder2d/index';
import '../../2d/lightoccluder2d/index.r3f';
import '../../../linter/index';

describe('polygonToSegments', () => {
  it('returns null for fewer than 2 points', () => {
    expect(polygonToSegments([], true)).toBeNull();
    expect(polygonToSegments([0, 0], true)).toBeNull();
  });

  it('closed 2-point polygon → 2 segments (4 positions)', () => {
    const pts = [0, 0, 16, 0];
    const out = polygonToSegments(pts, true);
    expect(out).toBeDefined();
    expect(out!.length).toBe(12); // 2 segments * 2 ends * 3 components
    // Check the second segment wraps back: (16,0) → (0,0)
    expect(out![3]).toBe(16);
    expect(out![4]).toBeFalsy(); // y = 0 (may be -0, use toBeFalsy)
    expect(out![8]).toBeFalsy();
    expect(out![9]).toBeFalsy();
  });

  it('open 2-point polygon → 1 segment (2 positions)', () => {
    const pts = [0, 0, 16, 0];
    const out = polygonToSegments(pts, false);
    expect(out).toBeDefined();
    expect(out!.length).toBe(6); // 1 segment * 2 ends * 3 components
  });

  it('closed 4-pt square → 4 segments (8 positions)', () => {
    const pts = [
      0, 0, 16, 0,
      16, 16, 0, 16,
    ];
    const out = polygonToSegments(pts, true);
    expect(out!.length).toBe(24); // 4 segments * 2 * 3
  });

  it('open 4-pt chain → 3 segments (6 positions)', () => {
    const pts = [
      0, 0, 16, 0,
      16, 16, 0, 16,
    ];
    const out = polygonToSegments(pts, false);
    expect(out!.length).toBe(18); // 3 segments * 2 * 3
  });

  it('y-negates correctly (Godot Y-down → three Y-up)', () => {
    // Points (0,10) and (10,0), open → 1 segment.
    const out = polygonToSegments([0, 10, 10, 0], false);
    // First point (0, 10) → y = -10 in three-space
    expect(out![1]).toBe(-10);
    // Second point (10, 0) → y = 0 (may be -0)
    expect(out![4]).toBeFalsy();
  });
});

describe('parseOccluderCullMode', () => {
  it('defaults to CULL_DISABLED when the property is absent', () => {
    expect(parseOccluderCullMode(undefined)).toBe(OCCLUDER_CULL_DISABLED);
  });

  it('reads the enum ordinals Godot writes', () => {
    expect(parseOccluderCullMode('0')).toBe(OCCLUDER_CULL_DISABLED);
    expect(parseOccluderCullMode('1')).toBe(OCCLUDER_CULL_CLOCKWISE);
    expect(parseOccluderCullMode('2')).toBe(OCCLUDER_CULL_COUNTER_CLOCKWISE);
  });

  it('falls back to CULL_DISABLED for an out-of-range or unreadable value', () => {
    expect(parseOccluderCullMode('3')).toBe(OCCLUDER_CULL_DISABLED);
    expect(parseOccluderCullMode('-1')).toBe(OCCLUDER_CULL_DISABLED);
    expect(parseOccluderCullMode('clockwise')).toBe(OCCLUDER_CULL_DISABLED);
  });
});

/**
 * A `Root` (Node2D) > `Occ` (LightOccluder2D) scene at Godot (200, 100) with a
 * 4-point square OccluderPolygon2D.
 */
function occScene(subProps = '', nodeProps = ''): string {
  return `[gd_scene format=3]

[sub_resource type="OccluderPolygon2D" id="1"]
polygon = PackedVector2Array(0, 0, 16, 0, 16, 16, 0, 16)
${subProps}

[node name="Root" type="Node2D"]

[node name="Occ" type="LightOccluder2D" parent="."]
position = Vector2(200, 100)
occluder = SubResource("1")
${nodeProps}
`;
}

async function renderIntoRegistry(tscn: string) {
  const scene = new TscnParser().parse(tscn);
  const registry = createShadowCasterRegistry();
  await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <SceneResourcesProvider
        internalResources={scene.internalResources}
        externalResources={scene.externalResources}
      >
        <SelectionProvider>
          <ShadowCasterProvider registry={registry}>
            <NodeDispatcher nodes={scene.nodes} />
          </ShadowCasterProvider>
        </SelectionProvider>
      </SceneResourcesProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return registry;
}

describe('LightOccluder2D publishes to the shadow-caster registry', () => {
  it('registers one caster even though the outline gizmo stays unselected', async () => {
    expect((await renderIntoRegistry(occScene())).casters()).toHaveLength(1);
  });

  it('publishes segments at the node world position, Y-negated', async () => {
    const registry = await renderIntoRegistry(occScene());
    const [entry] = worldShadowCasters(registry, 1);
    // 4 points closed → 4 edges → 8 world points. The polygon's (16,16) corner
    // sits at Godot (216,116), i.e. three-space (216,-116).
    expect(entry!.segments).toHaveLength(16);
    const points: [number, number][] = [];
    for (let i = 0; i < entry!.segments.length; i += 2) {
      points.push([entry!.segments[i]!, entry!.segments[i + 1]!]);
    }
    expect(points).toContainEqual([216, -116]);
    expect(points.some(([, y]) => y === 116)).toBe(false);
  });

  it('carries cull_mode from the OccluderPolygon2D sub-resource', async () => {
    const registry = await renderIntoRegistry(occScene('cull_mode = 2'));
    expect(worldShadowCasters(registry, 1)[0]!.cullMode).toBe(OCCLUDER_CULL_COUNTER_CLOCKWISE);
  });

  it('gates on occluder_light_mask, not on the CanvasItem light_mask', async () => {
    const masked = await renderIntoRegistry(occScene('', 'occluder_light_mask = 2'));
    expect(worldShadowCasters(masked, 1)).toEqual([]);
    expect(worldShadowCasters(masked, 2)).toHaveLength(1);

    const canvasMask = await renderIntoRegistry(occScene('', 'light_mask = 4'));
    expect(worldShadowCasters(canvasMask, 1)).toHaveLength(1);
  });

  it('casts nothing while the occluder is hidden', async () => {
    const registry = await renderIntoRegistry(occScene('', 'visible = false'));
    expect(registry.casters()).toHaveLength(1);
    expect(worldShadowCasters(registry, 1)).toEqual([]);
  });

  it('registers nothing when the occluder resource is missing', async () => {
    const tscn = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Occ" type="LightOccluder2D" parent="."]
`;
    expect((await renderIntoRegistry(tscn)).casters()).toEqual([]);
  });
});

describe('LightOccluder2D registration', () => {
  it('registers LightOccluder2D in the node (parser) registry', () => {
    expect(nodeRegistry.getRegistration('LightOccluder2D')).toBeTruthy();
  });

  it('registers a LightOccluder2D r3f component', () => {
    expect(nodeComponentRegistry.get('LightOccluder2D')).toBeDefined();
  });
});

describe('LightOccluder2D fixture is lint-clean', () => {
  it('fixture unit-lightoccluder2d.tscn lints with no errors', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const raw = readFileSync(resolve(fixturesDir(), 'unit-lightoccluder2d.tscn'), 'utf8');
    const errors = new Linter().lint(raw).filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

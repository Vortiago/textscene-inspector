/**
 * `<GraphNode>` render contract: panel/titlebar chrome at the band the solve hands it, per-slot
 * ports and slot boxes, and resizer. Structure and tint only: the golden images
 * own the pixels.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { drawnStyleBox } from '../../../../r3f/controls/native/testing/drawnStyleBox';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import { GraphNode } from './Component';
import { countTintSplit, splitTints } from '../../../../r3f/controls/native/testing/tintSplit';
import { defaultGraphNodeSlot } from './parser';
import type { GraphNodeProperties } from './types';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import {
  UNSET_VIEWPORT_TEXTURE,
  UNSET_VIEWPORT_TEXTURE_REF,
} from '../../../../resources/textures/viewporttexture/unsetViewportTexture.testkit';
import { bundledRunOf, bundledRunMeshes } from '../../../../r3f/controls/native/testing/bundledRunStub';
import { titlebarBandHeightChannel } from '../graphelement/graphTitlebar';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 100 };

/** The band the solve hands the painter: the 23 px line of the default title font and the 4 px box margins. */
const BAND = titlebarBandHeightChannel.seal(31);

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function graphNode(properties: Partial<GraphNodeProperties> = {}, children: SolveNode[] = []): SolveNode {
  const node: TscnNode = controlNode('N', 'GraphNode', { name: 'N', slots: new Map(), ...properties });
  return withThemeItems({ ...emptySolveNode(), path: 'N', node, children });
}

/** A StyleBoxQuad chrome mesh carries a `color` vertex attribute; a ControlQuad (icon/text) does not. */
function chromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

function iconMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter(
      (m) =>
        (m.geometry as THREE.BufferGeometry).attributes.color === undefined && bundledRunOf(m) === undefined
    );
}

describe('<GraphNode> (isolated painter contract)', () => {
  it('draws exactly two chrome meshes (panel + titlebar) with no children/title/slots', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode {...painterEnv()} meta={BAND} solveNode={graphNode()} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(2);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
    expect(iconMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws no title text: the internal title_label draws it', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...painterEnv()}
        meta={BAND}
        solveNode={graphNode({ title: 'Hello' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws no resizer icon when resizable is unset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode {...painterEnv()} meta={BAND} solveNode={graphNode()} rect={RECT} renderOrder={0} />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws the resizer icon when resizable is true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...painterEnv()}
        meta={BAND}
        solveNode={graphNode({ resizable: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(1);
  });

  it("tints the resizer icon with the node's resizer_color (graph_node.cpp:699)", async () => {
    const themed = graphNode({ resizable: true });
    const red = { r: 1, g: 0, b: 0, a: 1 };
    const solveNode = { ...themed, colors: { ...themed.colors, resizer_color: red } };
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode {...painterEnv()} meta={BAND} solveNode={solveNode} rect={RECT} renderOrder={0} />
    );
    const [resizer] = iconMeshes(renderer.scene);
    expect((resizer!.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xff0000);
  });

  it('draws one port icon per enabled side of a declared slot', async () => {
    const child: SolveNode = {
      ...emptySolveNode(),
      path: 'N/c',
      node: controlNode('c', 'Control', { name: 'c' }),
    };
    const slots = new Map([[0, { ...defaultGraphNodeSlot(), leftEnabled: true, rightEnabled: true }]]);
    const env = painterEnv();
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...env}
        solveNode={graphNode({ slots }, [child])}
        rect={RECT}
        renderOrder={0}
        childRects={new Map([['N/c', { x: 0, y: 40, w: 100, h: 20 }]])}
      />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(2);
  });

  /** Godot draws a port icon at its reported size, which is 0 for an unset ViewportTexture (`viewport.cpp:156-160`). */
  it('draws a port icon that reports size 0 with no area', async () => {
    const fake = createFakeResourceLoader();
    const child: SolveNode = {
      ...emptySolveNode(),
      path: 'N/c',
      node: controlNode('c', 'Control', { name: 'c' }),
    };
    const slots = new Map([
      [0, { ...defaultGraphNodeSlot(), leftEnabled: true, leftIcon: UNSET_VIEWPORT_TEXTURE_REF }],
    ]);
    const solveNode = {
      ...graphNode({ slots }, [child]),
      resources: { externalResources: [], internalResources: [UNSET_VIEWPORT_TEXTURE] },
    };
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <GraphNode
          {...painterEnv()}
          meta={BAND}
          solveNode={solveNode}
          rect={RECT}
          renderOrder={0}
          childRects={new Map([['N/c', { x: 0, y: 40, w: 100, h: 20 }]])}
        />
      </ResourceLoaderProvider>
    );
    const port = new THREE.Box3().setFromObject(iconMeshes(renderer.scene)[0]!);
    expect([port.max.x - port.min.x, port.max.y - port.min.y]).toEqual([0, 0]);
  });

  it('draws no ports for a slot with both sides disabled (the default)', async () => {
    const child: SolveNode = {
      ...emptySolveNode(),
      path: 'N/c',
      node: controlNode('c', 'Control', { name: 'c' }),
    };
    const slots = new Map([[0, defaultGraphNodeSlot()]]);
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...painterEnv()}
        meta={BAND}
        solveNode={graphNode({ slots }, [child])}
        rect={RECT}
        renderOrder={0}
        childRects={new Map([['N/c', { x: 0, y: 40, w: 100, h: 20 }]])}
      />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws THREE chrome meshes when a declared slot draws its own stylebox', async () => {
    const child: SolveNode = {
      ...emptySolveNode(),
      path: 'N/c',
      node: controlNode('c', 'Control', { name: 'c' }),
    };
    const slots = new Map([[0, { ...defaultGraphNodeSlot(), drawStylebox: true }]]);
    const drawn = withThemeItems({
      ...graphNode({ slots }, [child]),
      styleBoxes: { titlebar: drawnStyleBox(), slot: drawnStyleBox() },
    });
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...painterEnv()}
        meta={BAND}
        solveNode={drawn}
        rect={RECT}
        renderOrder={0}
        childRects={new Map([['N/c', { x: 0, y: 40, w: 100, h: 20 }]])}
      />
    );
    // panel + titlebar + the slot stylebox, each given a box that paints
    expect(chromeMeshes(renderer.scene)).toHaveLength(3);
  });
});

describe('<GraphNode> chrome placement', () => {
  /** World Y of a mesh, in three space (Godot Y-down is negated by the painter). */
  function worldY(scene: Rendered['scene'], mesh: THREE.Mesh) {
    scene.instance.updateMatrixWorld(true);
    return mesh.getWorldPosition(new THREE.Vector3()).y;
  }

  /** A mesh's own height, from its geometry bounding box. */
  function meshHeight(mesh: THREE.Mesh) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    return bb.max.y - bb.min.y;
  }

  it('draws the body panel BELOW the titlebar, not over it (graph_node.cpp:634-641)', async () => {
    // `Rect2 body_rect(0, titlebar_rect.size.height, ...)`. `StyleBoxQuad`
    // takes only a size, so the offset has to come from the group around it.
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...painterEnv()}
        meta={BAND}
        solveNode={graphNode({ title: 'N' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    // The band is the height the solve seals: `BAND`.
    const [body, titlebar] = chromeMeshes(renderer.scene);
    expect(worldY(renderer.scene, titlebar!)).toBe(0);
    expect(worldY(renderer.scene, body!)).toBe(-31);
    expect(meshHeight(titlebar!)).toBeGreaterThan(0);
  });
});

describe('<GraphNode> — self_modulate', () => {
  it('tints the panel and the title bar with tint, and nothing with childTint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...painterEnv()}
        meta={BAND}
        {...splitTints}
        solveNode={withThemeItems({
          ...graphNode({ title: 'Hello' }),
          styleBoxes: { titlebar: drawnStyleBox() },
        })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(countTintSplit(renderer.scene)).toEqual({ own: 2, child: 0 });
  });
});

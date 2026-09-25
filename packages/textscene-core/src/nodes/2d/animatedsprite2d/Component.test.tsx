/**
 * AnimatedSprite2D render behaviour: resolves the current animation frame from
 * the SpriteFrames SubResource and draws it as a modulated quad. A missing
 * sprite_frames falls back to the placeholder.
 */
import type { ReactElement } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseAnimatedSprite2D } from './parser';
import { AnimatedSprite2D } from './Component';
import { parseTresFile } from '../../../parser/parsedResource';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type AnimationTransport,
} from '../../../r3f/contexts/AnimationTransportContext';
import {
  useOptionalSelection,
  type SelectionContextValue,
} from '../../../r3f/contexts/SelectionContext';
import { NodePathProvider } from '../../../r3f/contexts/NodePathContext';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import type { TscnNode } from '../../../parser/types';

const heading = { type: 'node', attributes: { type: 'AnimatedSprite2D', name: 'A' } };
const TEX = 'res://frame3.png';

const ANIMATIONS =
  '[{"frames": [{"duration": 1.0, "texture": ExtResource("2")}, {"duration": 1.0, "texture": ExtResource("3")}], "loop": true, "name": &"right", "speed": 5.0}]';

function makeNode(raw: Record<string, string> = {}, children: TscnNode[] = []): TscnNode {
  return {
    name: 'A',
    type: 'AnimatedSprite2D',
    children,
    properties: parseAnimatedSprite2D(heading, raw),
  };
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

async function render(rootNode: TscnNode) {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
  fake.textures.seed(TEX, tex);
  const renderNode = (n: TscnNode): ReactElement => (
    <AnimatedSprite2D node={n}>
      {n.children.map((c, i) => (
        <AnimatedSprite2D key={i} node={c} />
      ))}
    </AnimatedSprite2D>
  );
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider
        internalResources={[{ id: 'sf', type: 'SpriteFrames', data: { animations: ANIMATIONS, id: 'sf' } }]}
        externalResources={[{ id: '3', type: 'Texture2D', path: TEX }]}
      >
        {renderNode(rootNode)}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

describe('AnimatedSprite2D render', () => {
  it('draws the current frame texture as a quad with the modulate tint applied', async () => {
    const r = await render(
      makeNode({
        sprite_frames: 'SubResource("sf")',
        animation: '&"right"',
        frame: '1',
        modulate: 'Color(0.5, 0.5, 0.5, 1)',
      })
    );
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.map).toBeTruthy();
    expect((mesh.geometry as THREE.PlaneGeometry).parameters.width).toBe(32);
    expect(material.color.r).toBeCloseTo(srgbToLinear(0.5), 4);
  });

  it('renders the magenta placeholder when sprite_frames is missing', async () => {
    const r = await render(makeNode({}));
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    const material = mesh.material as THREE.MeshBasicMaterial;
    expect(material.color.getHexString()).toBe('ff00ff');
  });
});

describe('AnimatedSprite2D playback (transport-driven)', () => {
  // Two-frame "right" at 5 fps (0.2s/frame, 0.4s loop). Distinct widths per frame.
  const FRAMES_2 =
    '[{"frames": [{"duration": 1.0, "texture": ExtResource("2")}, {"duration": 1.0, "texture": ExtResource("3")}], "loop": true, "name": &"right", "speed": 5.0}]';
  const SPRITE_PATH = 'Root/A';

  let transport: AnimationTransport;
  let selection: SelectionContextValue | null;
  function Capture() {
    transport = useAnimationTransport();
    selection = useOptionalSelection();
    return null;
  }

  async function mount(frame = '0') {
    const fake = createFakeResourceLoader();
    const tex0 = new THREE.Texture();
    (tex0 as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
    const tex1 = new THREE.Texture();
    (tex1 as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 16 };
    fake.textures.seed('res://f0.png', tex0);
    fake.textures.seed('res://f1.png', tex1);
    const node: TscnNode = {
      name: 'A',
      type: 'AnimatedSprite2D',
      children: [],
      properties: parseAnimatedSprite2D(heading, {
        sprite_frames: 'SubResource("sf")',
        animation: '&"right"',
        frame,
      }),
    };
    return ReactThreeTestRenderer.create(
      <SceneStack
        loader={fake.loader}
        scene={{
          internalResources: [{ id: 'sf', type: 'SpriteFrames', data: { animations: FRAMES_2, id: 'sf' } }],
          externalResources: [
            { id: '2', type: 'Texture2D', path: 'res://f0.png' },
            { id: '3', type: 'Texture2D', path: 'res://f1.png' },
          ],
        }}
      >
        <AnimationTransportProvider>
          <Capture />
          <NodePathProvider path={SPRITE_PATH}>
            <AnimatedSprite2D node={node} />
          </NodePathProvider>
        </AnimationTransportProvider>
      </SceneStack>
    );
  }

  function frameWidth(r: Awaited<ReturnType<typeof mount>>): number {
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    return (mesh.geometry as THREE.PlaneGeometry).parameters.width;
  }
  const settle = () => ReactThreeTestRenderer.act(async () => {});
  const select = (path: string | null) =>
    ReactThreeTestRenderer.act(async () => selection?.setSelectedNodePath(path));

  it('registers its clips with the transport only while selected', async () => {
    const r = await mount('0');
    expect(transport.clips).toEqual([]); // unselected → no Animation tab
    await select(SPRITE_PATH);
    expect(transport.hasPlayer).toBe(true);
    expect(transport.clips).toEqual(['right']);
    await r.unmount();
  });

  it('shows the authored frame while stopped — does not autoplay on select', async () => {
    const r = await mount('1'); // authored frame 1
    expect(frameWidth(r)).toBe(64);
    await select(SPRITE_PATH);
    expect(frameWidth(r)).toBe(64); // selecting alone keeps the static authored frame
  });

  it('advances the frame while playing', async () => {
    const r = await mount('0');
    await select(SPRITE_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.3); // playhead 0.3s → frame 1
    await settle();
    expect(frameWidth(r)).toBe(64);
  });

  it('samples the seeked frame while paused', async () => {
    const r = await mount('0');
    await select(SPRITE_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await ReactThreeTestRenderer.act(async () => transport.pause());
    await ReactThreeTestRenderer.act(async () => transport.seek(0.3)); // into frame 1's window
    await r.advanceFrames(1, 0);
    await settle();
    expect(frameWidth(r)).toBe(64);
  });

  it('returns to the authored frame on stop', async () => {
    const r = await mount('0');
    await select(SPRITE_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.3);
    await settle();
    expect(frameWidth(r)).toBe(64); // playing → frame 1
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await settle();
    expect(frameWidth(r)).toBe(32); // authored frame 0
  });

  it('stop rewinds the transport playhead to 0 (no stale flush overwrites the reset)', async () => {
    const r = await mount('0');
    await select(SPRITE_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.3);
    await settle();
    await ReactThreeTestRenderer.act(async () => transport.stop());
    await r.advanceFrames(2, 0.1); // frames where a (buggy) stop-edge flush would fire
    await settle();
    expect(transport.time).toBe(0); // the scrubber/timecode read 0:00 while stopped
  });

  it('advances in real time despite the WI-213 reportTime throttle (local playhead, not transport.time)', async () => {
    // Date.now barely moves in tests, so transport.time stays frozen after the first
    // commit and the throttled time would leave the playhead in frame 0. The local
    // accumulator reaches frame 1. The check stops at 0.3s, short of the 0.4s loop
    // end, because a wrap lands on either frame.
    const r = await mount('0');
    await select(SPRITE_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(18, 1 / 60); // 0.3s accumulated in ~0ms of wall time
    await settle();
    expect(frameWidth(r)).toBe(64); // frame 1: a throttle-frozen clock stays on frame 0 (32)
  });

  it('honours the #224 preview Speed multiplier', async () => {
    const r = await mount('0');
    await select(SPRITE_PATH);
    await ReactThreeTestRenderer.act(async () => transport.setPlaybackSpeed(2));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.15); // 0.15s × 2 = 0.3s → frame 1 (at 1x it'd still be frame 0)
    await settle();
    expect(frameWidth(r)).toBe(64);
  });

  it("honours the #224 Loop override: 'once' holds an authored-looping clip at its last frame", async () => {
    const r = await mount('0');
    await select(SPRITE_PATH);
    await ReactThreeTestRenderer.act(async () => transport.setLoopOverride('once'));
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.55); // past the 0.4s clip end
    await settle();
    // 'auto' would wrap ((0.55 % 0.4) = 0.15s → frame 0). 'once' clamps to the
    // end and holds the last frame.
    expect(frameWidth(r)).toBe(64);
  });

  it('stops driving when another node is selected', async () => {
    const r = await mount('0');
    await select(SPRITE_PATH);
    await ReactThreeTestRenderer.act(async () => transport.play());
    await r.advanceFrames(1, 0.3);
    await settle();
    expect(frameWidth(r)).toBe(64);
    await select('Root/Other'); // deselect the sprite
    await settle();
    expect(frameWidth(r)).toBe(32); // back to the authored frame
  });
});

describe('AnimatedSprite2D authored-frame reactivity', () => {
  // speed 0 → not playing, so the displayed frame is the authored `props.frame`
  // and must stay reactive to live .tscn edits (the fiber is reused across an
  // edit because NodeDispatcher keys nodes by node.name).
  const STATIC_2 =
    '[{"frames": [{"duration": 1.0, "texture": ExtResource("2")}, {"duration": 1.0, "texture": ExtResource("3")}], "loop": true, "name": &"pose", "speed": 0.0}]';

  function makeFake() {
    const fake = createFakeResourceLoader();
    const tex0 = new THREE.Texture();
    (tex0 as unknown as { image: { width: number; height: number } }).image = { width: 32, height: 16 };
    const tex1 = new THREE.Texture();
    (tex1 as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 16 };
    fake.textures.seed('res://f0.png', tex0);
    fake.textures.seed('res://f1.png', tex1);
    return fake;
  }

  function tree(fake: ReturnType<typeof createFakeResourceLoader>, frame: string) {
    const node: TscnNode = {
      name: 'A',
      type: 'AnimatedSprite2D',
      children: [],
      properties: parseAnimatedSprite2D(heading, {
        sprite_frames: 'SubResource("sf")',
        animation: '&"pose"',
        frame,
      }),
    };
    return (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[{ id: 'sf', type: 'SpriteFrames', data: { animations: STATIC_2, id: 'sf' } }]}
          externalResources={[
            { id: '2', type: 'Texture2D', path: 'res://f0.png' },
            { id: '3', type: 'Texture2D', path: 'res://f1.png' },
          ]}
        >
          <AnimatedSprite2D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  }

  it('reflects a changed authored frame on a reused fiber when not playing', async () => {
    const fake = makeFake();
    const r = await ReactThreeTestRenderer.create(tree(fake, '0'));
    const width = () => ((r.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.PlaneGeometry).parameters.width;
    expect(width()).toBe(32); // authored frame 0

    await ReactThreeTestRenderer.act(async () => {
      await r.update(tree(fake, '1')); // edit frame 0 → 1 on the same fiber
    });
    await ReactThreeTestRenderer.act(async () => {}); // settle the texture swap
    expect(width()).toBe(64); // frame 1: reactive, not frozen at 0
  });
});

describe('AnimatedSprite2D AtlasTexture frames (sprite-sheet packing)', () => {
  // Each frame is a SubResource AtlasTexture over one 64×64 sheet: frame 0 is a
  // 16×16 cell at (0,0), frame 1 a 16×32 cell at (16,0). The shared Texture2D
  // resolver crops the cell, so the quad is sized from `image`, not a UV window.
  // happy-dom has no 2D context, so a recording canvas stub asserts the crop.
  const ATLAS_ANIM =
    '[{"frames": [{"duration": 1.0, "texture": SubResource("Atlas_a")}, {"duration": 1.0, "texture": SubResource("Atlas_b")}], "loop": true, "name": &"spin", "speed": 5.0}]';

  const drawCalls: number[][] = [];

  /**
   * Only the 2D context is faked, on the prototype: the R3F test renderer makes
   * a canvas of its own and must keep its real context.
   */
  function stubCanvas2D() {
    const ctx = {
      imageSmoothingEnabled: true,
      drawImage: (_image: unknown, ...args: number[]) => void drawCalls.push(args),
    };
    const proto = globalThis.HTMLCanvasElement.prototype;
    const original = proto.getContext;
    vi.spyOn(proto, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      return type === '2d'
        ? (ctx as unknown as CanvasRenderingContext2D)
        : (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof proto.getContext);
  }

  afterEach(() => {
    drawCalls.length = 0;
    vi.restoreAllMocks();
  });

  async function render(frame: string) {
    stubCanvas2D();
    const fake = createFakeResourceLoader();
    const atlas = new THREE.Texture();
    (atlas as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 64 };
    fake.textures.seed('res://atlas.png', atlas);
    const node: TscnNode = {
      name: 'A',
      type: 'AnimatedSprite2D',
      children: [],
      properties: parseAnimatedSprite2D(heading, {
        sprite_frames: 'SubResource("sf")',
        animation: '&"spin"',
        frame,
      }),
    };
    return ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[
            { id: 'sf', type: 'SpriteFrames', data: { animations: ATLAS_ANIM, id: 'sf' } },
            { id: 'Atlas_a', type: 'AtlasTexture', data: { atlas: 'ExtResource("2")', region: 'Rect2(0, 0, 16, 16)', id: 'Atlas_a' } },
            { id: 'Atlas_b', type: 'AtlasTexture', data: { atlas: 'ExtResource("2")', region: 'Rect2(16, 0, 16, 32)', id: 'Atlas_b' } },
          ]}
          externalResources={[{ id: '2', type: 'Texture2D', path: 'res://atlas.png' }]}
        >
          <AnimatedSprite2D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  }

  it('draws the frame-0 cell at the cell size, sampling its own corner of the sheet', async () => {
    const r = await render('0');
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    const geom = mesh.geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBe(16);
    expect(geom.parameters.height).toBe(16);
    expect(drawCalls[0]).toEqual([0, 0, 16, 16, 0, 0, 16, 16]);

    // The crop is the cell, so the quad samples all of it. A leftover UV window
    // here would show a sixteenth of the cell.
    const map = (mesh.material as THREE.MeshBasicMaterial).map!;
    expect(map).toBeTruthy();
    expect([map.repeat.x, map.repeat.y]).toEqual([1, 1]);
    expect([map.offset.x, map.offset.y]).toEqual([0, 0]);
  });

  it('sizes a differently-shaped cell (frame 1 = 16×32)', async () => {
    const r = await render('1');
    const geom = (r.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBe(16);
    expect(geom.parameters.height).toBe(32);
    expect(drawCalls[0]).toEqual([16, 0, 16, 32, 0, 0, 16, 32]);
  });
});

describe('AnimatedSprite2D external .tres SpriteFrames', () => {
  // sprite_frames = ExtResource(".tres"): the frame ExtResource ids are scoped to
  // the .tres file, not the scene, so they resolve against the file's own ext section.
  const tresDrawCalls: number[][] = [];

  afterEach(() => {
    tresDrawCalls.length = 0;
    vi.restoreAllMocks();
  });
  const TRES = `[gd_resource type="SpriteFrames" format=3]

[ext_resource type="Texture2D" path="res://bump.png" id="1_bump"]
[ext_resource type="Texture2D" path="res://idle.png" id="2_idle"]

[resource]
animations = [{
"frames": [{
"duration": 1.0,
"texture": ExtResource("1_bump")
}],
"loop": false,
"name": &"bump",
"speed": 5.0
}, {
"frames": [{
"duration": 1.0,
"texture": ExtResource("2_idle")
}],
"loop": false,
"name": &"idle",
"speed": 5.0
}]
`;

  async function render(animation: string) {
    const fake = createFakeResourceLoader();
    const bump = new THREE.Texture();
    (bump as unknown as { image: { width: number; height: number } }).image = { width: 24, height: 24 };
    const idle = new THREE.Texture();
    (idle as unknown as { image: { width: number; height: number } }).image = { width: 48, height: 24 };
    fake.textures.seed('res://bump.png', bump);
    fake.textures.seed('res://idle.png', idle);
    fake.resources.seed('res://anim_player.tres', parseTresFile(TRES));
    const node: TscnNode = {
      name: 'A',
      type: 'AnimatedSprite2D',
      children: [],
      properties: parseAnimatedSprite2D(heading, {
        sprite_frames: 'ExtResource("4_sf")',
        animation,
      }),
    };
    return ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: '4_sf', type: 'SpriteFrames', path: 'res://anim_player.tres' }]}
        >
          <AnimatedSprite2D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  }

  it('renders a frame from the .tres, resolved against the file’s own ext ids', async () => {
    const r = await render('&"idle"');
    const mesh = r.scene.findByType('Mesh').instance as THREE.Mesh;
    expect((mesh.material as THREE.MeshBasicMaterial).map).toBeTruthy();
    expect((mesh.geometry as THREE.PlaneGeometry).parameters.width).toBe(48); // idle.png
  });

  it('selects another clip from the same .tres', async () => {
    const r = await render('&"bump"');
    const geom = (r.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBe(24); // bump.png
  });

  it('crops an AtlasTexture that lives in the .tres, against the FILE’s own pools', async () => {
    // The cell is a sub-resource of the .tres, and its `atlas` is an ext id scoped
    // to the .tres too. Resolving either against the scene finds nothing.
    const ATLAS_TRES = `[gd_resource type="SpriteFrames" format=3]

[ext_resource type="Texture2D" path="res://sheet.png" id="1_sheet"]

[sub_resource type="AtlasTexture" id="AtlasTexture_cell"]
atlas = ExtResource("1_sheet")
region = Rect2(8, 40, 20, 12)

[resource]
animations = [{
"frames": [{
"duration": 1.0,
"texture": SubResource("AtlasTexture_cell")
}],
"loop": false,
"name": &"cell",
"speed": 5.0
}]
`;
    const ctx = {
      imageSmoothingEnabled: true,
      drawImage: (_image: unknown, ...args: number[]) => void tresDrawCalls.push(args),
    };
    const proto = globalThis.HTMLCanvasElement.prototype;
    const original = proto.getContext;
    vi.spyOn(proto, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      return type === '2d'
        ? (ctx as unknown as CanvasRenderingContext2D)
        : (original as (...args: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof proto.getContext);

    const fake = createFakeResourceLoader();
    const sheetTexture = new THREE.Texture();
    (sheetTexture as unknown as { image: { width: number; height: number } }).image = {
      width: 64,
      height: 64,
    };
    fake.textures.seed('res://sheet.png', sheetTexture);
    fake.resources.seed('res://anim_player.tres', parseTresFile(ATLAS_TRES));
    const node: TscnNode = {
      name: 'A',
      type: 'AnimatedSprite2D',
      children: [],
      properties: parseAnimatedSprite2D(heading, {
        sprite_frames: 'ExtResource("4_sf")',
        animation: '&"cell"',
      }),
    };
    const r = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: '4_sf', type: 'SpriteFrames', path: 'res://anim_player.tres' }]}
        >
          <AnimatedSprite2D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );

    const geom = (r.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect([geom.parameters.width, geom.parameters.height]).toEqual([20, 12]);
    expect(tresDrawCalls[0]).toEqual([8, 40, 20, 12, 0, 0, 20, 12]);
  });

  it('renders nothing (not the missing placeholder) while the .tres is still loading', async () => {
    // No resource seeded, so useResource('Resource') stays pending. A valid,
    // loading .tres must not flash the magenta missing-resource placeholder.
    const fake = createFakeResourceLoader();
    const node: TscnNode = {
      name: 'A',
      type: 'AnimatedSprite2D',
      children: [],
      properties: parseAnimatedSprite2D(heading, {
        sprite_frames: 'ExtResource("4_sf")',
        animation: '&"walk"',
      }),
    };
    const r = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: '4_sf', type: 'SpriteFrames', path: 'res://anim_player.tres' }]}
        >
          <AnimatedSprite2D node={node} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    expect(r.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});

import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DrawableCell } from '../../resources/tileset/drawableCell';
import { tileTextureAt } from '../../resources/tileset/testing/tileTexture';
import { defaultTileData, type AtlasSourceModel, type TileGrid } from '../../resources/tileset/types';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import type { AtlasCell } from '../../resources/useTexture2D';
import type { CanvasShaderCommand } from './canvasCommands';
import * as imagePixels from '../../resources/formats/image/imagePixels';
import { inThreadJobRunner } from '../../workers/WorkerJobRunner';
import { TileShaderRun } from './TileShaderRun';
import { ErrorBoundary } from '../components/ErrorBoundary';
import type { AtlasPixels } from '../../resources/tileset/paddedAtlas';

/** What the mocked texture hook returns, set by each test and reset after it. */
const sampled = vi.hoisted(() => ({
  texture: null as THREE.Texture | null,
  missing: false,
  atlasCell: undefined as AtlasCell | undefined,
}));

vi.mock('../canvasItemTexture', () => ({
  useCanvasItemTextureSampledBy: () => ({
    texture: sampled.texture,
    missing: sampled.missing,
    atlasCell: sampled.atlasCell,
    canvasTexture: null,
    sampler: { filter: 0, repeat: 0 },
  }),
}));

/** Written by the mocked slot on each render, cleared after each test. */
const slotCommands = vi.hoisted(() => ({
  last: null as readonly CanvasShaderCommand[] | null,
  texture: null as THREE.Texture | null,
}));

vi.mock('./CanvasShaderSlot', () => ({
  CanvasShaderSlot: ({
    commands,
    texture,
    fallback,
  }: {
    commands: readonly CanvasShaderCommand[];
    texture: THREE.Texture;
    fallback: unknown;
  }) => {
    slotCommands.last = commands;
    slotCommands.texture = texture;
    return <group name="slot">{fallback as never}</group>;
  },
}));

const GRID: TileGrid = { shape: 0, layout: 0, offsetAxis: 0, tileSize: { x: 16, y: 16 } };
const TILE = { sizeInAtlas: { x: 1, y: 1 }, alternatives: new Map() };
const SHADER: ShaderText = {
  code: 'shader_type canvas_item;\n',
  file: 'res://a.gdshader',
  parameters: {},
  textures: {},
};
const SOURCE: AtlasSourceModel = {
  texture: tileTextureAt('res://tiles.png'),
  margins: { x: 0, y: 0 },
  separation: { x: 0, y: 0 },
  textureRegionSize: { x: 16, y: 16 },
  usesTexturePadding: false,
  tiles: new Map([
    ['0:0', TILE],
    ['3:0', TILE],
  ]),
};
const WHITE = { r: 1, g: 1, b: 1, a: 1 };

function cellAt(x: number, atlasX: number): DrawableCell {
  const tileData = defaultTileData();
  return {
    coords: { x, y: 0 },
    sourceId: 0,
    atlasCoords: { x: atlasX, y: 0 },
    alternativeId: 0,
    source: SOURCE,
    tile: TILE,
    tileData,
  };
}

function run(itemOrigin = { x: 0, y: 0 }, cells = [cellAt(0, 0)], source = SOURCE) {
  return ReactThreeTestRenderer.create(
    <TileShaderRun
      shader={SHADER}
      source={source}
      cells={cells}
      tileSet={{ ...GRID, usesUvClipping: false }}
      finalModulate={WHITE}
      sampler={{ filter: 0, repeat: 0 }}
      renderOrder={0}
      itemOrigin={itemOrigin}
      fallback={<group name="fallback" />}
    />
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  sampled.texture = null;
  sampled.missing = false;
  sampled.atlasCell = undefined;
  slotCommands.last = null;
  slotCommands.texture = null;
});

describe('TileShaderRun', () => {
  it('draws the slot for a source whose texture is here', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    const renderer = await run();

    expect(renderer.scene.findAll((node) => node.props.name === 'slot')).toHaveLength(1);
  });

  it('draws nothing for a texture that failed to load', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    sampled.missing = true;
    const renderer = await run();

    expect(renderer.scene.children).toHaveLength(0);
  });

  it('draws nothing while the texture is pending', async () => {
    const renderer = await run();

    expect(renderer.scene.children).toHaveLength(0);
  });

  it('places the item at its origin and the fallback back in layer pixels', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    const renderer = await run({ x: 24, y: 40 });

    const item = renderer.scene.children[0]!.instance as THREE.Object3D;
    const fallback = renderer.scene.findByProps({ name: 'fallback' }).parent!.instance as THREE.Object3D;
    expect(item.position.toArray()).toEqual([24, -40, 0]);
    expect(fallback.position.toArray()).toEqual([-24, 40, 0]);
  });

  it('gives the slot no rect for a cell past the texture grid', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    await run(undefined, [cellAt(0, 0), cellAt(1, 3)]);

    expect(slotCommands.last).toHaveLength(1);
  });

  it('samples a padded source it cannot read at its unpadded regions', async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    vi.spyOn(imagePixels, 'readImagePixels').mockReturnValue(undefined);
    await run(undefined, [cellAt(0, 1)], { ...SOURCE, usesTexturePadding: true });

    await vi.waitFor(() => expect(slotCommands.texture).toBe(sampled.texture));
    const command = slotCommands.last![0]!;
    expect(command.kind === 'rect' && command.region.source).toEqual({ x: 16, y: 0, w: 16, h: 16 });
  });

  it("draws an unpadded AtlasTexture's cells from its whole atlas, shifted by its region", async () => {
    sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    const sheet = new THREE.DataTexture(new Uint8Array(64 * 64 * 4), 64, 64);
    sampled.atlasCell = {
      sheet,
      sheetSize: { width: 64, height: 64 },
      cell: { x: 8, y: 4, w: 32, h: 16 },
      region: { x: 0, y: 0, w: 32, h: 16 },
      filterClip: false,
    };
    await run();

    const command = slotCommands.last![0]!;
    expect(slotCommands.texture).toBe(sheet);
    expect(command.kind === 'rect' && command.region.source).toEqual({ x: 8, y: 4, w: 16, h: 16 });
  });
});

type SourceKind = 'padded' | 'unpadded AtlasTexture' | 'plain atlas';
type CopyState =
  | 'first build pending'
  | 'rebuilt after a re-parse'
  | 'cells moved by a re-parse'
  | 'texture swapped'
  | 'pixels unreadable'
  | 'build throws'
  | 'released mid-build';
type Drawn = 'nothing' | 'padded copy' | 'previous padded copy' | 'texture' | 'whole atlas' | 'error';

interface CopyStateRow {
  kind: SourceKind;
  state: CopyState;
  during: Drawn;
  after: Drawn;
  /** What Godot draws once the state settles. */
  godot: string;
}

const GODOT_PADS = 'the padded copy (tile_set.cpp:5612-5671)';
const GODOT_UNPADDED = 'the texture itself (tile_map_layer.cpp:2676-2690)';
const GODOT_ATLAS = 'the whole atlas (atlas_texture.cpp:180-224)';

/** Every state of the padded copy, for each kind of source a shaded tile run samples. */
const COPY_STATES: readonly CopyStateRow[] = [
  {
    kind: 'padded',
    state: 'first build pending',
    during: 'nothing',
    after: 'padded copy',
    godot: GODOT_PADS,
  },
  {
    kind: 'padded',
    state: 'rebuilt after a re-parse',
    during: 'previous padded copy',
    after: 'padded copy',
    godot: GODOT_PADS,
  },
  {
    kind: 'padded',
    state: 'cells moved by a re-parse',
    during: 'nothing',
    after: 'padded copy',
    godot: GODOT_PADS,
  },
  { kind: 'padded', state: 'texture swapped', during: 'nothing', after: 'padded copy', godot: GODOT_PADS },
  { kind: 'padded', state: 'pixels unreadable', during: 'texture', after: 'texture', godot: GODOT_PADS },
  { kind: 'padded', state: 'build throws', during: 'nothing', after: 'error', godot: GODOT_PADS },
  { kind: 'padded', state: 'released mid-build', during: 'nothing', after: 'nothing', godot: 'nothing' },
  ...(
    ['first build pending', 'rebuilt after a re-parse', 'pixels unreadable', 'build throws'] as const
  ).flatMap((state): CopyStateRow[] => [
    { kind: 'unpadded AtlasTexture', state, during: 'whole atlas', after: 'whole atlas', godot: GODOT_ATLAS },
    { kind: 'plain atlas', state, during: 'texture', after: 'texture', godot: GODOT_UNPADDED },
  ]),
  {
    kind: 'unpadded AtlasTexture',
    state: 'released mid-build',
    during: 'whole atlas',
    after: 'nothing',
    godot: 'nothing',
  },
  { kind: 'plain atlas', state: 'released mid-build', during: 'texture', after: 'nothing', godot: 'nothing' },
];

/** The padded-atlas jobs a test lands or fails one at a time, oldest first. */
function heldJobs() {
  const held: { resolve: (padded: AtlasPixels) => void; reject: (error: Error) => void }[] = [];
  vi.spyOn(inThreadJobRunner, 'run').mockImplementation(
    () => new Promise((resolve, reject) => held.push({ resolve, reject })) as never
  );
  return {
    land: () => held.shift()?.resolve({ data: new Uint8Array(36 * 18 * 4), width: 36, height: 18 }),
    fail: () => held.shift()?.reject(new Error('expected the padded-atlas job to fail')),
  };
}

/** Lets each effect, job and microtask the last step started run out. */
const settle = () => ReactThreeTestRenderer.act(() => new Promise((done) => setTimeout(done)));

function shadedRun(source: AtlasSourceModel) {
  return (
    <ErrorBoundary fallback={() => <group name="error" />}>
      <TileShaderRun
        shader={SHADER}
        source={source}
        cells={[cellAt(0, 0)]}
        tileSet={{ ...GRID, usesUvClipping: false }}
        finalModulate={WHITE}
        sampler={{ filter: 0, repeat: 0 }}
        renderOrder={0}
        itemOrigin={{ x: 0, y: 0 }}
        fallback={<group name="fallback" />}
      />
    </ErrorBoundary>
  );
}

function drawnIn(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  previous?: THREE.Texture
): Drawn {
  const named = (name: string) => renderer.scene.findAll((node) => node.props.name === name).length > 0;
  if (named('error')) return 'error';
  if (!named('slot')) return 'nothing';
  if (slotCommands.texture === sampled.atlasCell?.sheet) return 'whole atlas';
  if (slotCommands.texture === sampled.texture) return 'texture';
  return slotCommands.texture === previous ? 'previous padded copy' : 'padded copy';
}

/** Drives `state` and gives what the run draws while it holds and once it settles. */
async function drawnAcross(kind: SourceKind, state: CopyState): Promise<[Drawn, Drawn]> {
  sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
  if (kind === 'unpadded AtlasTexture') {
    const sheet = new THREE.DataTexture(new Uint8Array(64 * 64 * 4), 64, 64);
    const cell = { x: 8, y: 4, w: 32, h: 16 };
    sampled.atlasCell = {
      sheet,
      sheetSize: { width: 64, height: 64 },
      cell,
      region: cell,
      filterClip: false,
    };
  }
  if (state === 'pixels unreadable') vi.spyOn(imagePixels, 'readImagePixels').mockReturnValue(undefined);
  const jobs = heldJobs();
  const source = { ...SOURCE, usesTexturePadding: kind === 'padded' };
  const renderer = await ReactThreeTestRenderer.create(shadedRun(source));
  await settle();
  if (
    state === 'rebuilt after a re-parse' ||
    state === 'cells moved by a re-parse' ||
    state === 'texture swapped'
  ) {
    jobs.land();
    await settle();
    const previous = slotCommands.texture ?? undefined;
    if (state === 'texture swapped')
      sampled.texture = new THREE.DataTexture(new Uint8Array(32 * 16 * 4), 32, 16);
    const moved = { ...source, margins: { x: 1, y: 0 } };
    await renderer.update(shadedRun(state === 'cells moved by a re-parse' ? moved : { ...source }));
    await settle();
    const during = drawnIn(renderer, previous);
    jobs.land();
    await settle();
    return [during, drawnIn(renderer, previous)];
  }
  const during = drawnIn(renderer);
  if (state === 'released mid-build') await renderer.unmount();
  if (state === 'build throws') jobs.fail();
  else jobs.land();
  await settle();
  return [during, drawnIn(renderer)];
}

describe('TileShaderRun across the states of its padded copy', () => {
  it.each(COPY_STATES)('$kind, $state: $during, then $after; Godot draws $godot', async (row) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(await drawnAcross(row.kind, row.state)).toEqual([row.during, row.after]);
  });
});

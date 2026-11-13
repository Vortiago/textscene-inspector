/**
 * The `TEXTURE_2D` kind decodes each form of a Texture2D chain to one value, with every resource of
 * the chain inline in the scene or each in a `.tres` of its own: Godot loads an `ExtResource` as it
 * loads a sub-resource.
 */
import { describe, expect, it } from 'vitest';
import type { Read } from '../../reading';
import { sceneTables } from '../../reading/reading.testkit';
import { nodeReference, referenceHeldBy } from '../../reading/scopedReference';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { TEXTURE_2D } from './kind';
import type { Texture2D } from './types';

/**
 * One resource of a chain. `{{id}}` in the body names another resource of the chain. A resource
 * with a `path` is an image file the loader imports, never written out.
 */
interface ChainResource {
  readonly className: string;
  readonly id: string;
  readonly body?: string;
  readonly path?: string;
}

const NAMED = /\{\{(\w+)\}\}/g;

/** The `.tres` path of a resource the chain writes to a file of its own, or its image path. */
function pathOf(resource: ChainResource): string {
  return resource.path ?? `res://${resource.id}.tres`;
}

function extResourceLine(resource: ChainResource): string {
  return `[ext_resource type="${resource.className}" path="${pathOf(resource)}" id="${resource.id}"]`;
}

/** The `[ext_resource]` line of each resource `body` names. */
function extLinesFor(body: string, chain: readonly ChainResource[]): string[] {
  const ids = new Set([...body.matchAll(NAMED)].map(([, id]) => id));
  return chain.filter((r) => ids.has(r.id)).map(extResourceLine);
}

function bodyWith(
  resource: ChainResource,
  chain: readonly ChainResource[],
  isExternal: (r: ChainResource) => boolean
) {
  return (resource.body ?? '').replace(NAMED, (_, id: string) => {
    const named = chain.find((r) => r.id === id)!;
    return isExternal(named) ? `ExtResource("${id}")` : `SubResource("${id}")`;
  });
}

const isImported = (resource: ChainResource) => resource.path !== undefined;

/** The value the chain's last resource decodes to, every resource a sub-resource of the scene. */
function inline(chain: readonly ChainResource[]): Texture2D {
  const written = chain.filter((r) => !isImported(r));
  const extLines = chain.filter(isImported).map(extResourceLine);
  const sections = written.map(
    (r) => `[sub_resource type="${r.className}" id="${r.id}"]\n${bodyWith(r, chain, isImported)}`
  );
  const outer = chain.at(-1)!;
  const ref = isImported(outer) ? `ExtResource("${outer.id}")` : `SubResource("${outer.id}")`;
  return loaded(`${[...extLines, ...sections].join('\n\n')}\n`, ref, {});
}

/** The value the chain's last resource decodes to, every resource in a `.tres` of its own. */
function eachInItsOwnFile(chain: readonly ChainResource[]): Texture2D {
  const files: Record<string, string> = {};
  for (const resource of chain.filter((r) => !isImported(r))) {
    const extLines = extLinesFor(resource.body ?? '', chain);
    files[pathOf(resource)] = `[gd_resource type="${resource.className}" format=3]\n\n${extLines.join(
      '\n'
    )}\n\n[resource]\n${bodyWith(resource, chain, () => true)}\n`;
  }
  const outer = chain.at(-1)!;
  return loaded(extResourceLine(outer), `ExtResource("${outer.id}")`, files);
}

function loaded(scene: string, ref: string, files: Record<string, string>): Texture2D {
  const read = staticSnapshot(files).read(nodeReference(ref, sceneTables(scene)), TEXTURE_2D);
  if (read.status !== 'loaded') throw new Error(`expected the Texture2D to load, got ${read.status}`);
  return read.value;
}

/**
 * The texture as plain data. A reference keeps only whether it is set: its id is scoped to the
 * tables that hold it, which differ by origin, and the value it names is in the summary.
 */
function summary(texture: Texture2D): unknown {
  switch (texture.form) {
    case 'canvas': {
      const { texture: canvasTexture, normalTexture, specularTexture } = texture.canvasTexture;
      const maps = { hasNormal: normalTexture !== null, hasSpecular: specularTexture !== null };
      return { form: 'canvas', canvasTexture, ...maps, diffuse: readSummary(texture.diffuse) };
    }
    case 'atlas': {
      const { atlas: sheetReference, ...atlas } = texture.atlas;
      return { form: 'atlas', atlas, hasSheet: sheetReference !== null, sheet: readSummary(texture.sheet) };
    }
    case 'noise': {
      const { noise, colorRamp, ...decoded } = texture.texture;
      const references = { hasNoise: noise !== null, hasColorRamp: colorRamp !== null };
      return { form: 'noise', texture: decoded, ...references, sources: texture.sources };
    }
    default:
      return texture;
  }
}

function readSummary(read: Read<Texture2D>): unknown {
  return read.status === 'loaded' ? summary(read.value) : read.status;
}

const RED_TO_BLUE = 'colors = PackedColorArray(1, 0, 0, 1, 0, 0, 1, 1)';
const IMAGE_BODY = `data = {
"data": PackedByteArray(255, 0, 0, 255, 0, 255, 0, 255),
"format": "RGBA8",
"height": 1,
"mipmaps": false,
"width": 2
}`;

const ICON: ChainResource = { className: 'Texture2D', id: 'icon', path: 'res://icon.png' };
const GRADIENT: ChainResource = { className: 'Gradient', id: 'ramp', body: RED_TO_BLUE };
const GRADIENT_TEXTURE: ChainResource = {
  className: 'GradientTexture2D',
  id: 'gradientTexture',
  body: 'gradient = {{ramp}}\nwidth = 4\nheight = 2',
};
const REGION = 'region = Rect2(2, 0, 2, 2)';

const CHAINS: readonly { name: string; chain: readonly ChainResource[] }[] = [
  {
    name: 'an ImageTexture over an Image',
    chain: [
      { className: 'Image', id: 'image', body: IMAGE_BODY },
      { className: 'ImageTexture', id: 'imageTexture', body: 'image = {{image}}' },
    ],
  },
  { name: 'a GradientTexture2D over a Gradient', chain: [GRADIENT, GRADIENT_TEXTURE] },
  {
    name: 'a NoiseTexture2D over a FastNoiseLite and a colour ramp',
    chain: [
      { className: 'FastNoiseLite', id: 'noise', body: 'seed = 7\nfrequency = 0.05' },
      GRADIENT,
      {
        className: 'NoiseTexture2D',
        id: 'noiseTexture',
        body: 'noise = {{noise}}\ncolor_ramp = {{ramp}}\nwidth = 8\nheight = 8',
      },
    ],
  },
  {
    name: 'a CanvasTexture over an image file, with a normal map',
    chain: [
      ICON,
      {
        className: 'CanvasTexture',
        id: 'canvas',
        body: 'diffuse_texture = {{icon}}\nnormal_texture = {{icon}}\nspecular_shininess = 0.5',
      },
    ],
  },
  {
    name: 'an AtlasTexture over a GradientTexture2D',
    chain: [
      GRADIENT,
      GRADIENT_TEXTURE,
      { className: 'AtlasTexture', id: 'atlas', body: `atlas = {{gradientTexture}}\n${REGION}` },
    ],
  },
  {
    name: 'an AtlasTexture over a CanvasTexture over an image file',
    chain: [
      ICON,
      { className: 'CanvasTexture', id: 'canvas', body: 'diffuse_texture = {{icon}}' },
      { className: 'AtlasTexture', id: 'atlas', body: `atlas = {{canvas}}\n${REGION}` },
    ],
  },
];

describe.each(CHAINS)('TEXTURE_2D of $name', ({ chain }) => {
  it('decodes the same value with each resource in its own .tres as with each inline', () => {
    expect(summary(eachInItsOwnFile(chain))).toEqual(summary(inline(chain)));
  });
});

describe('TEXTURE_2D of each form', () => {
  it('names the path of an image file', () => {
    expect(inline([ICON])).toEqual({ form: 'file', path: 'res://icon.png' });
  });

  it('reads the region and the sheet of an AtlasTexture', () => {
    const chain = [ICON, { className: 'AtlasTexture', id: 'atlas', body: `atlas = {{icon}}\n${REGION}` }];

    expect(summary(inline(chain))).toMatchObject({
      form: 'atlas',
      atlas: { region: { x: 2, y: 0, width: 2, height: 2 } },
      sheet: { form: 'file', path: 'res://icon.png' },
    });
  });

  it('reads no diffuse map of a CanvasTexture that names none', () => {
    const chain = [{ className: 'CanvasTexture', id: 'canvas' }];

    expect(summary(inline(chain))).toMatchObject({ form: 'canvas', hasNormal: false, diffuse: 'none' });
  });

  it('gives a GradientTexture2D with no gradient no gradient to draw', () => {
    const chain = [{ className: 'GradientTexture2D', id: 'gradientTexture', body: 'width = 32' }];

    expect(inline(chain)).toMatchObject({ form: 'gradient', gradient: null, texture: { width: 32 } });
  });
});

describe('TEXTURE_2D of a texture that draws nothing', () => {
  /** The read of `ref` in a scene written as `scene`, held locally. */
  const readOf = (scene: string, ref: string) =>
    staticSnapshot({}).read(nodeReference(ref, sceneTables(scene)), TEXTURE_2D);

  it.each([
    ['an ImageTexture with no image', '[sub_resource type="ImageTexture" id="t"]\n'],
    ['a NoiseTexture2D with no noise', '[sub_resource type="NoiseTexture2D" id="t"]\n'],
    [
      'a GradientTexture2D whose gradient names a missing resource',
      '[sub_resource type="GradientTexture2D" id="t"]\ngradient = SubResource("missing")\n',
    ],
  ])('cannot decode %s', (_name, scene) => {
    expect(readOf(scene, 'SubResource("t")')).toMatchObject({ status: 'unavailable', reason: 'undecodable' });
  });

  it('refuses a resource that is no Texture2D', () => {
    expect(readOf('[sub_resource type="Gradient" id="t"]\n', 'SubResource("t")')).toMatchObject({
      status: 'unavailable',
      reason: 'wrong-type',
    });
  });
});

describe('TEXTURE_2D of a ViewportTexture', () => {
  const SCENE = sceneTables(
    '[sub_resource type="ViewportTexture" id="v"]\nviewport_path = NodePath("SubViewport")\nresource_local_to_scene = true\n'
  );
  const viewportAt = (isHeldLocally: boolean) =>
    staticSnapshot({}).read(referenceHeldBy('SubResource("v")', SCENE, isHeldLocally), TEXTURE_2D).value;

  it('sets up a local ViewportTexture every holder of which is local to scene', () => {
    expect(viewportAt(true)).toEqual({ form: 'viewport', viewportPath: 'SubViewport', isSetUp: true });
  });

  it('sets up no ViewportTexture held by a resource that is not local to scene', () => {
    expect(viewportAt(false)).toMatchObject({ isSetUp: false });
  });
});

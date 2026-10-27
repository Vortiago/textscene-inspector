/**
 * The texture a consumer samples: the sampler state it states (ADR-0044) laid over a shared source.
 * The view is the source when it already samples that way, and one source-sharing clone when it
 * does not, which the view then owns and frees. A consumer that writes the view asks for a clone
 * always (`ownedTextureView`). Not a resource slice (ADR-0031): it decodes nothing.
 */

import * as THREE from 'three';
import { applyUvWindow, type UvWindow } from '../../r3f/uvWindow';
import { applyTextureFilterState, textureFilterMatches, type TextureFilterState } from './godotTextureFilter';

/** Below this, a repeat or offset is indistinguishable from the one a texture shows. */
const WINDOW_EPSILON = 1e-6;

/** What a view samples. A field left out states no opinion, so the source's value stands. */
export interface ViewSampler {
  /**
   * The colour space the consumer samples in. Required: only the consumer knows what its sampler
   * reads, whatever the producer tagged.
   */
  colorSpace: THREE.ColorSpace;
  /** Only an authored filter diverges, so a source with no mipmaps does not clone for a filter nobody asked for. */
  filter?: TextureFilterState;
  /** Both axes. A glTF or file-loaded entry arrives clamped (ADR-0044). */
  wrap?: THREE.Wrapping;
  /** The part of the texture the consumer samples. */
  window?: UvWindow;
  /** three's UV channel the consumer samples, `UV2_CHANNEL` for Godot's UV2. Omitted means the first set. */
  channel?: number;
}

/**
 * Whether two samplers state the same values, so a consumer that builds one each render keeps its
 * view. No sampler is null or undefined alike.
 */
export function sameViewSampler(
  a: ViewSampler | null | undefined,
  b: ViewSampler | null | undefined
): boolean {
  if (!a || !b) return !a === !b;
  return (
    a.colorSpace === b.colorSpace &&
    a.wrap === b.wrap &&
    (a.channel ?? 0) === (b.channel ?? 0) &&
    sameFilter(a.filter, b.filter) &&
    sameWindow(a.window, b.window)
  );
}

function sameFilter(a: TextureFilterState | undefined, b: TextureFilterState | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.magFilter === b.magFilter &&
    a.minFilter === b.minFilter &&
    a.generateMipmaps === b.generateMipmaps &&
    a.anisotropy === b.anisotropy
  );
}

function sameWindow(a: UvWindow | undefined, b: UvWindow | undefined): boolean {
  if (!a || !b) return a === b;
  return (
    a.repeat.x === b.repeat.x &&
    a.repeat.y === b.repeat.y &&
    a.offset.x === b.offset.x &&
    a.offset.y === b.offset.y
  );
}

/**
 * Written only by `clonedView`. A WeakSet, not a texture field, since `Texture.clone()` copies
 * `userData` and a clone of a view would claim a release it never made.
 */
const ownedViews = new WeakSet<THREE.Texture>();

/**
 * Pins `texture.colorSpace` to `colorSpace`. `@react-three/fiber`'s `applyProps` (`events-*.js`, the
 * `colorMaps.includes(key)` branch over `['map', 'emissiveMap', 'sheenColorMap', 'specularColorMap',
 * 'envMap']`) rewrites an 8-bit texture there to `SRGBColorSpace` every commit outside `linear`
 * mode, which no `<Canvas>` sets.
 */
export function pinColorSpace(texture: THREE.Texture, colorSpace: THREE.ColorSpace): THREE.Texture {
  Object.defineProperty(texture, 'colorSpace', {
    get: () => colorSpace,
    set: () => {
      // Discards `@react-three/fiber`'s reassignment. A pin, not a write after the
      // commit, so no effect order can undo it. It covers props the `colorMaps`
      // list does not name too, since that list can grow.
    },
    configurable: true,
    enumerable: true,
  });
  return texture;
}

/** `pinColorSpace` to `NoColorSpace`. */
export function pinNoColorSpace(texture: THREE.Texture): THREE.Texture {
  return pinColorSpace(texture, THREE.NoColorSpace);
}

/**
 * The texture `sampler` samples: `source` when it already carries the state, else one clone that
 * carries every divergence. `useResource` shares one cached texture per path, while Godot keeps this
 * state per material and slot, so a write to the source would let the last consumer win for all.
 * `releaseView` frees a clone, and leaves a source to its loader.
 */
export function textureView(source: THREE.Texture, sampler: ViewSampler): THREE.Texture {
  // A render target (a ViewportTexture) is never cloned: a clone is a frozen
  // frame. Nor is it re-tagged: its pass reads the tag as its output space, and
  // its storage, not the tag, decides what a sample decodes.
  if (source.isRenderTargetTexture || !diverges(source, sampler)) return source;
  return clonedView(source, sampler);
}

/**
 * `textureView` that always clones, for a consumer that writes the clone afterwards, as a sprite
 * moves its window to the next frame. The consumer may write any field of the result, and owns it.
 * A render target is the exception: it belongs to its viewport, so it comes back as it is.
 */
export function ownedTextureView(source: THREE.Texture, sampler: ViewSampler): THREE.Texture {
  if (source.isRenderTargetTexture) return source;
  return clonedView(source, sampler);
}

/**
 * The texture when a view made it, null when a loader or a producer owns it: a view of a source is
 * that source, and a render target belongs to its viewport.
 */
export function viewToRelease(texture: THREE.Texture | null | undefined): THREE.Texture | null {
  return texture && ownedViews.has(texture) ? texture : null;
}

/** Frees the texture of a view: a clone is disposed, a shared source is left to its loader. */
export function releaseView(texture: THREE.Texture | null | undefined): void {
  viewToRelease(texture)?.dispose();
}

function diverges(source: THREE.Texture, sampler: ViewSampler): boolean {
  return (
    source.colorSpace !== sampler.colorSpace ||
    (sampler.wrap !== undefined && (source.wrapS !== sampler.wrap || source.wrapT !== sampler.wrap)) ||
    (sampler.filter !== undefined && !textureFilterMatches(source, sampler.filter)) ||
    source.channel !== (sampler.channel ?? 0) ||
    (sampler.window !== undefined && !showsWindow(source, sampler.window))
  );
}

/** One clone, however many reasons. `clone()` shares `source`, so the image bytes are not duplicated. */
function clonedView(source: THREE.Texture, sampler: ViewSampler): THREE.Texture {
  const clone = source.clone();
  if (sampler.window) applyUvWindow(clone, sampler.window);
  if (sampler.wrap !== undefined) clone.wrapS = clone.wrapT = sampler.wrap;
  clone.channel = sampler.channel ?? 0;
  if (sampler.filter) applyTextureFilterState(clone, sampler.filter);
  // Pinned, not assigned: R3F reasserts `SRGBColorSpace` on a `map` every commit.
  pinColorSpace(clone, sampler.colorSpace);
  clone.needsUpdate = true;
  ownedViews.add(clone);
  return clone;
}

function showsWindow(texture: THREE.Texture, { repeat, offset }: UvWindow): boolean {
  return (
    near(texture.repeat.x, repeat.x) &&
    near(texture.repeat.y, repeat.y) &&
    near(texture.offset.x, offset.x) &&
    near(texture.offset.y, offset.y)
  );
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < WINDOW_EPSILON;
}

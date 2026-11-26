import { Source, Texture } from 'three';

interface Follower {
  readonly source: Texture;
  version: number;
}

/** Written only by `followingCopy` and its holders: each copy's texture and the version it last read. */
// eslint-disable-next-line no-restricted-syntax -- a registry that `TextureCopies` writes and frees, not a cache.
const FOLLOWERS = new WeakMap<Texture, Follower>();

/** A texture that is no copy stays as it is. */
export function followSource(copy: Texture): void {
  const follower = FOLLOWERS.get(copy);
  if (follower === undefined || follower.version === follower.source.version) return;
  follower.version = follower.source.version;
  // three allocates a texture's storage once, so a new size takes new storage.
  if (!sameSize(copy.image as Sized, follower.source.image as Sized)) copy.dispose();
  copy.image = follower.source.image;
  copy.mipmaps = follower.source.mipmaps;
  copy.needsUpdate = true;
}

type Sized = { readonly width?: number; readonly height?: number } | null | undefined;

const sameSize = (a: Sized, b: Sized) => a?.width === b?.width && a?.height === b?.height;

/** A copy of `source` that `configure` sets up, which follows the source's updates before each draw. */
function followingCopy(source: Texture, configure: (copy: Texture) => void): Texture {
  const copy = cloneOf(source);
  configure(copy);
  copy.needsUpdate = true;
  FOLLOWERS.set(copy, { source, version: source.version });
  return copy;
}

/** Its own `Source`: three keeps one upload version per `Source` (`WebGLTextures.js:976`), not per state. */
function cloneOf(source: Texture): Texture {
  // Texture's own clone: a shared texture clones to itself (`sharedTexture`), and this copy needs its own.
  const copy = Texture.prototype.clone.call(source);
  copy.source = new Source(source.image);
  return copy;
}

/** A copy of a render target's texture that its pass refills, and the release that frees it. */
export interface TargetCopy {
  readonly copy: Texture;
  readonly release: () => void;
}

/** Null for a target no pass redraws. `configure` runs before the first fill, as three sets it once. */
export type TargetCopier = (source: Texture, configure: (copy: Texture) => void) => TargetCopy | null;

/** Written only by `installTargetCopies`, by the host that redraws render targets. */
let copyTarget: TargetCopier | null = null;

/** A render target's texture has no image a clone could upload, so the host that draws it copies it. */
export function installTargetCopies(copier: TargetCopier): void {
  copyTarget = copier;
}

interface Held {
  readonly copy: Texture;
  readonly onDispose: () => void;
  readonly release: () => void;
}

/** One sampler binding's copies, each given the binding's sampler state by `configure`. */
export class TextureCopies {
  /** Written only by `copyOf` and `free`: the copy of each material texture that a node may bind. */
  private readonly held = new Map<Texture, Held>();

  constructor(private readonly configure: (copy: Texture, source: Texture) => void) {}

  copyOf(source: Texture): Texture {
    const held = this.held.get(source);
    if (held) return held.copy;
    const { copy, release } = this.made(source);
    const onDispose = () => this.free(source);
    source.addEventListener('dispose', onDispose);
    this.held.set(source, { copy, onDispose, release });
    return copy;
  }

  private made(source: Texture): TargetCopy {
    const configure = (copy: Texture) => this.configure(copy, source);
    const target = source.isRenderTargetTexture ? copyTarget?.(source, configure) : null;
    if (target) return target;
    const copy = followingCopy(source, configure);
    return { copy, release: () => copy.dispose() };
  }

  /** three keeps a copy on the GPU until its `dispose`. */
  release(bound: Iterable<Texture>): void {
    const kept = new Set(bound);
    for (const [source, { copy }] of this.held) if (!kept.has(copy)) this.free(source);
  }

  private free(source: Texture): void {
    const { copy, onDispose, release } = this.held.get(source)!;
    source.removeEventListener('dispose', onDispose);
    this.held.delete(source);
    FOLLOWERS.delete(copy);
    release();
  }
}

/**
 * One following copy of each texture, shared by its holders and freed with the last. A source's
 * dispose leaves the copy: a long-lived source such as an atlas drops its storage to resize.
 */
export class SharedCopies {
  /** Written only by `hold` and `release`: each texture's copy and its holders. */
  private readonly held = new Map<Texture, { readonly copy: Texture; holders: number }>();

  constructor(private readonly configure: (copy: Texture, source: Texture) => void) {}

  hold(source: Texture): Texture {
    let held = this.held.get(source);
    if (!held) {
      const copy = followingCopy(source, (made) => this.configure(made, source));
      this.held.set(source, (held = { copy, holders: 0 }));
    }
    held.holders++;
    return held.copy;
  }

  release(source: Texture): void {
    const held = this.held.get(source);
    if (!held) throw new Error('expected a held texture to release, got one no holder holds');
    if (--held.holders > 0) return;
    this.held.delete(source);
    FOLLOWERS.delete(held.copy);
    held.copy.dispose();
  }
}

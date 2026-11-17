import { CompressedArrayTexture, DataArrayTexture, RGBAFormat, Source, type Texture } from 'three';

interface Follower {
  readonly source: Texture;
  version: number;
}

/** Written only by `TextureCopies`: the material texture each copy follows and the version it last read. */
// eslint-disable-next-line no-restricted-syntax -- a registry that `TextureCopies` writes and frees, not a cache.
const FOLLOWERS = new WeakMap<Texture, Follower>();

/** A texture that is no copy stays as it is. */
export function followSource(copy: Texture): void {
  const follower = FOLLOWERS.get(copy);
  if (follower === undefined || follower.version === follower.source.version) return;
  follower.version = follower.source.version;
  copy.image = follower.source.image;
  copy.mipmaps = follower.source.mipmaps;
  copy.needsUpdate = true;
}

/** Its own `Source`: three keeps one upload version per `Source` (`WebGLTextures.js:976`), not per state. */
function cloneOf(source: Texture): Texture {
  if (source instanceof DataArrayTexture && source.format === RGBAFormat && source.mipmaps.length > 1)
    return levelledCopyOf(source);
  const copy = source.clone();
  copy.source = new Source(source.image);
  return copy;
}

/** three uploads level 0 of a `DataArrayTexture` only (`WebGLTextures.js:1229`), every level of this one. */
function levelledCopyOf(source: DataArrayTexture): CompressedArrayTexture {
  const { width, height, depth } = source.image;
  const copy = new CompressedArrayTexture(
    source.mipmaps as never,
    width,
    height,
    depth,
    RGBAFormat as never,
    source.type
  );
  copy.internalFormat = source.internalFormat;
  copy.unpackAlignment = source.unpackAlignment;
  return copy;
}

interface Held {
  readonly copy: Texture;
  readonly onDispose: () => void;
}

/** One sampler binding's copies, each given the binding's sampler state by `configure`. */
export class TextureCopies {
  /** Written only by `copyOf` and `free`: the copy of each material texture that a node may bind. */
  private readonly held = new Map<Texture, Held>();

  constructor(private readonly configure: (copy: Texture, source: Texture) => void) {}

  copyOf(source: Texture): Texture {
    const held = this.held.get(source);
    if (held) return held.copy;
    const copy = cloneOf(source);
    this.configure(copy, source);
    copy.needsUpdate = true;
    FOLLOWERS.set(copy, { source, version: source.version });
    const onDispose = () => this.free(source);
    source.addEventListener('dispose', onDispose);
    this.held.set(source, { copy, onDispose });
    return copy;
  }

  /** three keeps a copy on the GPU until its `dispose`. */
  release(bound: Iterable<Texture>): void {
    const kept = new Set(bound);
    for (const [source, { copy }] of this.held) if (!kept.has(copy)) this.free(source);
  }

  private free(source: Texture): void {
    const { copy, onDispose } = this.held.get(source)!;
    source.removeEventListener('dispose', onDispose);
    this.held.delete(source);
    FOLLOWERS.delete(copy);
    copy.dispose();
  }
}

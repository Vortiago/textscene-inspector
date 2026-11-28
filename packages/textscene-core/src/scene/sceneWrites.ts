/** The writers whose values lie over the file, lowest first: the host's `set`, then the animated patch. */
const WRITE_LAYERS = ['host', 'animated'] as const;

export type WriteLayer = (typeof WRITE_LAYERS)[number];

/** Property name to Variant text, in the order Godot runs the setters. */
export type PropertyTexts = Readonly<Record<string, string>>;

/** By live path, each layer's texts in order. A write gives a new map that keeps the other entries. */
export type SceneWrites = ReadonlyMap<string, PropertyTexts>;

/** Written by WriteStore.write. Old revisions leave with the immutable texts of their snapshot. */
// eslint-disable-next-line no-restricted-syntax -- a write supplies the revisions, which cannot be derived from equal texts
const revisions = new WeakMap<PropertyTexts, ReadonlyMap<string, number>>();

export function writeRevision(texts: PropertyTexts | undefined, property: string): number {
  return (texts && revisions.get(texts)?.get(property)) ?? 0;
}

const NO_WRITES: SceneWrites = new Map();

/** The writes of every layer, kept as Variant text by live path. */
export class WriteStore {
  /** Written only by `write` and `clear`. */
  private readonly layers = new Map<WriteLayer, Map<string, Map<string, string>>>();
  /** Written only by `write` and `clear`: the laid texts, replaced as a whole on each change. */
  private laid: SceneWrites = NO_WRITES;

  /** One setter call's texts, in one new map. A rewritten property moves last, as its setter runs last. */
  write(
    layer: WriteLayer,
    path: string,
    written: readonly (readonly [property: string, text: string])[]
  ): void {
    let byPath = this.layers.get(layer);
    if (!byPath) this.layers.set(layer, (byPath = new Map()));
    let texts = byPath.get(path);
    if (!texts) byPath.set(path, (texts = new Map()));
    for (const [property, text] of written) {
      texts.delete(property);
      texts.set(property, text);
    }
    const next = new Map(this.laid);
    const previous = this.laid.get(path);
    const latest = new Map(previous && revisions.get(previous));
    for (const [property] of written) latest.set(property, (latest.get(property) ?? 0) + 1);
    const laid = this.layEach(path);
    revisions.set(laid, latest);
    next.set(path, laid);
    this.laid = next;
  }

  current(): SceneWrites {
    return this.laid;
  }

  clear(): void {
    this.layers.clear();
    this.laid = NO_WRITES;
  }

  private layEach(path: string): PropertyTexts {
    const texts: Record<string, string> = {};
    for (const layer of WRITE_LAYERS) {
      for (const [property, text] of this.layers.get(layer)?.get(path) ?? []) {
        delete texts[property];
        texts[property] = text;
      }
    }
    return Object.freeze(texts);
  }
}

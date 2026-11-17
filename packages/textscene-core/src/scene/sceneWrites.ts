/** The writers whose values lie over the file, lowest first: the host's `set`, then a playing animation. */
export const WRITE_LAYERS = ['host', 'animated'] as const;

export type WriteLayer = (typeof WRITE_LAYERS)[number];

/** Property name to Variant text, in the order Godot runs the setters. */
export type PropertyTexts = Readonly<Record<string, string>>;

/** By live path, every layer's texts laid in order. A new map after each write, its untouched entries kept. */
export type SceneWrites = ReadonlyMap<string, PropertyTexts>;

export const NO_WRITES: SceneWrites = new Map();

/** The writes of every layer, kept as Variant text by live path. */
export class WriteStore {
  /** Written only by `write` and `clear`. */
  private readonly layers = new Map<WriteLayer, Map<string, Map<string, string>>>();
  /** Written only by `write` and `clear`: the laid texts, replaced as a whole on each change. */
  private laid: SceneWrites = NO_WRITES;

  /** A rewrite of a property moves it last, so the later setter runs after the others, as in Godot. */
  write(layer: WriteLayer, path: string, property: string, text: string): void {
    let byPath = this.layers.get(layer);
    if (!byPath) this.layers.set(layer, (byPath = new Map()));
    let texts = byPath.get(path);
    if (!texts) byPath.set(path, (texts = new Map()));
    texts.delete(property);
    texts.set(property, text);
    const next = new Map(this.laid);
    next.set(path, this.layEach(path));
    this.laid = next;
  }

  /** The text `layer` wrote last for `property` at `path`. */
  written(layer: WriteLayer, path: string, property: string): string | undefined {
    return this.layers.get(layer)?.get(path)?.get(property);
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

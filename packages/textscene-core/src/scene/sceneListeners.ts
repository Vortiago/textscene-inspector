/** A host's observer of one node, by the path it gave, or of the tree's shape for null. */
interface Observer {
  readonly path: string | null;
  readonly listener: () => void;
}

/**
 * The listeners of one scene: each view, told of every change, and each host observer. The writes
 * of one task make one notice, so the views draw one frame for them.
 */
export class SceneListeners {
  private readonly views = new Set<() => void>();
  private readonly observers = new Set<Observer>();
  /** Written only by `written` and `flushWrites`: the absolute paths written since the last notice. */
  private writtenPaths = new Set<string>();

  /** `resolve` gives the absolute path a host's path names now, or null where it names no node. */
  constructor(private readonly resolve: (path: string) => string | null) {}

  subscribe(listener: () => void): () => void {
    this.views.add(listener);
    return () => this.views.delete(listener);
  }

  observe(path: string | null, listener: () => void): () => void {
    const observer = { path, listener };
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /** A write to the node at absolute path `path`, told with the task's other writes. */
  written(path: string): void {
    if (this.writtenPaths.size === 0) queueMicrotask(() => this.flushWrites());
    this.writtenPaths.add(path);
  }

  /** A new text: every node is new, so every view and every observer hears it now. */
  textChanged(): void {
    this.writtenPaths = new Set();
    for (const listener of [...this.views]) listener();
    for (const { listener } of [...this.observers]) listener();
  }

  /** A load that changed the tree's shape. */
  treeChanged(): void {
    for (const { path, listener } of [...this.observers]) if (path === null) listener();
  }

  clear(): void {
    this.views.clear();
    this.observers.clear();
    this.writtenPaths = new Set();
  }

  private flushWrites(): void {
    const paths = this.writtenPaths;
    if (paths.size === 0) return;
    this.writtenPaths = new Set();
    for (const listener of [...this.views]) listener();
    for (const { path, listener } of [...this.observers]) {
      const resolved = path === null ? null : this.resolve(path);
      if (resolved !== null && paths.has(resolved)) listener();
    }
  }
}

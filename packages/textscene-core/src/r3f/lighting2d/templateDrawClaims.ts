// A claim changes no React state of the item, so a draw that claims it causes no render.
/** The template draws that light a lit item's pixels: while one does, its classic light read stays off. */
export class TemplateDrawClaims {
  private count = 0;
  /** Written only by `whileUnclaimed`: each held registration, told when the claims start or end. */
  private readonly watchers = new Set<() => void>();

  /** Takes the pixels into a template draw, and returns the step that gives them back. */
  readonly claim = (): (() => void) => {
    if (this.count++ === 0) this.tellWatchers();
    let isReleased = false;
    return () => {
      if (isReleased) return;
      isReleased = true;
      if (--this.count === 0) this.tellWatchers();
    };
  };

  /** Holds `register`'s registration while no draw claims the pixels, until the returned release. */
  whileUnclaimed(register: () => () => void): () => void {
    let release = this.count === 0 ? register() : null;
    const follow = () => {
      if (this.count > 0) {
        release?.();
        release = null;
      } else release ??= register();
    };
    this.watchers.add(follow);
    return () => {
      this.watchers.delete(follow);
      release?.();
    };
  }

  private tellWatchers(): void {
    for (const watcher of this.watchers) watcher();
  }
}

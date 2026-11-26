/** The stage's CSS translate and scale: screen = pan + canvas pixel * zoom. */
export interface StageView {
  pan: { x: number; y: number };
  zoom: number;
}

/** The view a reader follows: the one now, and a call on each change. */
export interface StageViewSource {
  current(): StageView;
  /** Calls `onChange` after each new view, until the returned function runs. */
  subscribe(onChange: () => void): () => void;
}

/** Written only by the stage that creates it. */
export class StageViewStore implements StageViewSource {
  private view: StageView;
  private readonly listeners = new Set<() => void>();

  constructor(initial: StageView) {
    this.view = initial;
  }

  current = (): StageView => this.view;

  subscribe = (onChange: () => void): (() => void) => {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  };

  set(next: StageView): void {
    this.view = next;
    for (const onChange of this.listeners) onChange();
  }
}

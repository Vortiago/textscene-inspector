import { variant, type NodeHandle, type Scene } from '@textscene/renderer';

/** What the browser console and a capture script reach: the open scene and the Variant reader. */
export interface SceneConsole {
  readonly scene: Scene;
  readonly variant: typeof variant;
  /** Selects a node, or none for null, as a click does. A capture script selects a node the tree hides. */
  readonly select: (node: NodeHandle | null) => void;
}

declare global {
  interface Window {
    /** Written only by {@link exposeScene}: the scene the previewer shows now. */
    textscene?: SceneConsole;
  }
}

/** Puts the open scene on `window.textscene`, so a person or a capture script writes its nodes. */
export function exposeScene(scene: Scene, select: (node: NodeHandle | null) => void): void {
  window.textscene = { scene, variant, select };
}

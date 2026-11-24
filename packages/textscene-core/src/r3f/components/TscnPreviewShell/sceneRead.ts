import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSceneTreeSubscription } from '../../currentCamera.js';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { ParseResult } from '../../../scene/parseScene.js';
import type { Scene } from '../../../scene/openScene.js';
import { ROOT_WINDOW_PATH } from '../../../scene/nodePathWalk.js';
import * as logger from '../../../logger.js';
import { perObject } from '../../../utils/perObject.js';

/** An async read of the scene from its root node, such as a count or a class walk. */
type SceneRead<T> = (root: NodeHandle) => Promise<T>;

/** The root window's one child. Null before the host has sent a scene. */
function sceneRootOf(scene: Scene): NodeHandle | null {
  return scene.getNodeOrNull(ROOT_WINDOW_PATH)?.getChildren()[0] ?? null;
}

/** Null until a read of the text lands. A write moves no owner and no class, so it reads nothing again. */
export function useSceneRead<T>(scene: Scene | undefined, read: SceneRead<T>): T | null {
  const observeTree = useSceneTreeSubscription(scene);
  const parse = useSyncExternalStore(observeTree, () => scene?.parse() ?? null);
  const shape = useSyncExternalStore(observeTree, () => (scene ? shapeOf(sceneRootOf(scene)) : ''));
  const [answer, setAnswer] = useState<{ parse: ParseResult | null; value: T | null } | null>(null);
  useEffect(() => {
    let isLatest = true;
    const root = scene ? sceneRootOf(scene) : null;
    const reading = root && scene ? sharedRead(scene, read, root, parse, shape) : Promise.resolve(null);
    reading
      .then((value) => {
        if (isLatest) setAnswer({ parse, value });
      })
      .catch((error: unknown) => {
        // A new text frees the nodes during the read, and the read runs again over the new ones.
        if (root?.isInsideTree()) logger.error(`expected the scene's nodes to read, got ${String(error)}`);
      });
    return () => {
      isLatest = false;
    };
  }, [scene, read, parse, shape]);
  return answer?.parse === parse ? answer.value : null;
}

function shapeOf(node: NodeHandle | null): string {
  return node ? `${node.path}:${node.type}(${node.getChildren().map(shapeOf).join(',')})` : '';
}

interface PendingRead {
  readonly parse: ParseResult | null;
  readonly shape: string;
  readonly answer: Promise<unknown>;
}

/** Written only by `sharedRead`. A new text or shape replaces a read's entry. */
const readsOf = perObject((_scene: Scene) => new Map<SceneRead<unknown>, PendingRead>());

/** One read for each scene, text and shape, so two panels that show one answer read the tree once. */
function sharedRead<T>(
  scene: Scene,
  read: SceneRead<T>,
  root: NodeHandle,
  parse: ParseResult | null,
  shape: string
): Promise<T> {
  const reads = readsOf(scene);
  const pending = reads.get(read);
  if (pending?.parse === parse && pending.shape === shape) return pending.answer as Promise<T>;
  const answer = read(root);
  reads.set(read, { parse, shape, answer });
  return answer;
}

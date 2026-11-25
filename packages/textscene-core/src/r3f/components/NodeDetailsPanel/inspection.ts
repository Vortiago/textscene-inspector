import { useMemo, useSyncExternalStore } from 'react';
import type { NodeHandle } from '../../../scene/nodeHandle.js';
import type { Scene } from '../../../scene/openScene.js';
import * as logger from '../../../logger.js';
import { useLandedRead, type LandingRead } from '../TscnPreviewShell/sceneRead.js';
import { instancedScenePath } from './formatters/base/instanceSection.js';
import { formatterOf } from './formatters/index.js';
import { inspectedNode, type PropertySection } from './formatters/inspectedNode.js';

export interface Inspection {
  readonly node: NodeHandle;
  readonly sections: readonly PropertySection[];
  /** The scene the node instances, null for none. */
  readonly instancedScene: string | null;
  readonly isCamera3D: boolean;
}

const NO_REVISION = () => () => undefined;

/** Null until the first read of `node` lands. A write, a new text and a load each read it again. */
export function useInspection(scene: Scene | undefined, node: NodeHandle | null): Inspection | null {
  const revision = useSyncExternalStore(scene?.subscribe ?? NO_REVISION, () => scene?.revision() ?? 0);
  const start = useMemo(
    () =>
      scene && node ? (): LandingRead<Inspection> => ({ root: node, answer: inspect(scene, node) }) : null,
    // Each change moves `revision`, and each change reads the node again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene, node, revision]
  );
  const inspection = useLandedRead(scene, start);
  return inspection?.node === node ? inspection : null;
}

async function inspect(scene: Scene, node: NodeHandle): Promise<Inspection> {
  const inspected = inspectedNode(node, scene.fileProperties(node.path));
  const formatter = formatterOf(node.type);
  const [sections, instancedScene, isCamera3D] = await Promise.all([
    formatter ? sectionsOf(node, formatter(inspected)) : [],
    instancedScenePath(inspected),
    node.call('is_class', 'Camera3D'),
  ]);
  return { node, sections, instancedScene, isCamera3D: isCamera3D === true };
}

/** A formatter that fails costs only its sections: the header rows and the camera toggle still show. */
async function sectionsOf(
  node: NodeHandle,
  sections: Promise<PropertySection[]>
): Promise<PropertySection[]> {
  try {
    return await sections;
  } catch (error) {
    logger.error(`expected the inspector to read ${node.path}, got ${String(error)}`);
    return [];
  }
}

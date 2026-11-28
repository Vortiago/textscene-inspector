import { headingLine } from '../../../../parser/overridePropertyWrites.js';
import type { LiveLink, LiveTree } from '../../../../r3f/liveSceneTree.js';
import { getAncestorPaths, relativeTo } from '../../../../utils/nodePath.js';
import type { AttachmentLayer } from './types.js';

export function compareLoadOrder(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); ++i) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return b.length - a.length;
}

function enclosingInstances(link: LiveLink, tree: LiveTree): LiveLink[] {
  return getAncestorPaths(link.path)
    .map((path) => tree.at(path)!)
    .filter((parent) => parent.step.isMerged);
}

export function attachmentLoad(link: LiveLink, tree: LiveTree, layer: AttachmentLayer) {
  const enclosing = enclosingInstances(link, tree);
  const owner = layer.writerScene
    ? enclosing.findIndex((parent) => parent.step.scope.instancedScenePaths?.includes(layer.writerScene!))
    : -1;
  const writer = enclosing.slice(0, owner + 1);
  const order = [...writer.map((parent) => headingLine(parent.raw.rawProperties)), layer.line];
  const root = layer.beforeParenting ? link.path : writer.at(-1)?.path;
  return {
    order,
    canReach(target: LiveLink) {
      if (root && relativeTo(root, target.path) === undefined) return false;
      if (relativeTo(target.path, link.path) !== undefined)
        return !layer.beforeParenting || target.path === link.path;
      const born = [...enclosingInstances(target, tree), target].map((parent) =>
        headingLine(parent.raw.rawProperties)
      );
      return compareLoadOrder(born, order) <= 0;
    },
  };
}

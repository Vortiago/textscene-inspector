import { headingFile, headingLine } from '../../../../parser/overridePropertyWrites.js';
import type { LiveLink, LiveTree } from '../../../../r3f/liveSceneTree.js';
import { getAncestorPaths, relativeTo } from '../../../../utils/nodePath.js';
import { perObject } from '../../../../utils/perObject.js';
import type { OverridePhase } from '../../../../core/NodeRegistry.js';

interface FileInstance {
  root: string;
  order: readonly number[];
}

export function compareLoadOrder(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); ++i) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  // packed_scene.cpp:227-231,261-265,492
  return b.length - a.length;
}

const instancesOf = perObject((tree: LiveTree) =>
  perObject((link: LiveLink) => {
    const files = new Map<symbol, FileInstance>();
    for (const path of [...getAncestorPaths(link.path), link.path]) {
      const instance = tree.at(path);
      if (!instance?.step.instancePath) continue;
      const raw = instance.raw.rawProperties;
      const author = headingFile(raw);
      let order = [...((author && files.get(author)?.order) || []), headingLine(raw)];
      const chain = instance.step.scope.instancedScenePaths ?? [];
      const first = chain.indexOf(instance.step.instancePath);
      if (first < 0) continue;
      for (const file of chain.slice(first)) {
        const root = tree.ctx.sceneCache.getCached(file)?.nodes[0];
        if (!root) continue;
        const id = headingFile(root.rawProperties);
        if (id) files.set(id, { root: path, order });
        order = [...order, headingLine(root.rawProperties)];
      }
    }
    return files;
  })
);

export function attachmentLoad(link: LiveLink, tree: LiveTree, layer: OverridePhase) {
  const writer = layer.file && instancesOf(tree)(link).get(layer.file);
  const order = [...(writer?.order ?? []), layer.line ?? Infinity];
  const root = layer.beforeParenting ? link.path : writer?.root;
  return {
    order,
    depth: root?.split('/').length ?? 1,
    exists(path: string) {
      const target = tree.at(path);
      return !!target && this.canReach(target);
    },
    canReach(target: LiveLink) {
      if (root && relativeTo(root, target.path) === undefined) return false;
      if (relativeTo(target.path, link.path) !== undefined)
        return !layer.beforeParenting || target.path === link.path;
      const raw = target.raw.rawProperties;
      const file = headingFile(raw);
      const birth = file && instancesOf(tree)(target).get(file);
      return compareLoadOrder([...(birth?.order ?? []), headingLine(raw)], order) <= 0;
    },
  };
}

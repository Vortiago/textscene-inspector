/**
 * The theme owners above a viewport's Controls: each Control or Window a `ThemeOwner` climb passes
 * before a node that is neither stops it (`ThemeOwner::assign_theme_on_parented`,
 * `scene/theme/theme_owner.cpp:92-109`). A window's Controls draw in their own forest, so the
 * forest starts from these.
 */

import type { SceneScope, TscnNode } from '../../../parser/types';
import type { LiveTree } from '../../../r3f/liveSceneTree';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes';
import { parentPathOf } from '../../../utils/nodePath';
import { perObject } from '../../../utils/perObject';
import { isEmbeddedWindow } from '../../viewport/subviewport/viewportBoundary';

/** A node that owns a theme, with the scope its `theme` ref resolves in. */
export interface ThemeOwner {
  node: TscnNode;
  scope: SceneScope;
}

function passesTheme(type: string): boolean {
  return descendsFromClass(type, 'Control') || descendsFromClass(type, 'Window');
}

export const NO_OWNERS: readonly ThemeOwner[] = [];

/**
 * The last owners answered for each window node. Written only by `viewportThemeOwners`, which hands
 * back the same array while its entries match, so a forest keyed on it rebuilds only when an owner
 * changes. An entry goes with its node.
 */
const lastOwnersOf = perObject((_window: TscnNode): { owners: readonly ThemeOwner[] } => ({
  owners: NO_OWNERS,
}));

/** The scope object is new on each tree, so its two resource lists stand for it. */
function sameOwner(a: ThemeOwner, b: ThemeOwner): boolean {
  return (
    a.node === b.node &&
    a.scope.externalResources === b.scope.externalResources &&
    a.scope.internalResources === b.scope.internalResources
  );
}

function sameOwners(a: readonly ThemeOwner[], b: readonly ThemeOwner[]): boolean {
  return a.length === b.length && a.every((owner, i) => sameOwner(owner, b[i]!));
}

/**
 * The owners above the viewport at `path`, nearest first. Only a window takes its parent's theme:
 * a SubViewport is neither a Control nor a Window, so its Controls start no climb.
 */
export function viewportThemeOwners(tree: LiveTree, path: string): readonly ThemeOwner[] {
  const viewport = tree.at(path)?.step.node;
  if (!viewport || !isEmbeddedWindow(viewport.type)) return NO_OWNERS;
  const owners: ThemeOwner[] = [];
  for (let above = parentPathOf(path); above !== null; above = parentPathOf(above)) {
    const link = tree.at(above);
    if (!link || !passesTheme(link.step.node.type)) break;
    owners.push({ node: link.step.node, scope: link.step.scope });
  }
  const last = lastOwnersOf(viewport);
  if (sameOwners(last.owners, owners)) return last.owners;
  last.owners = owners;
  return owners;
}

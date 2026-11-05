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
import { isEmbeddedWindow } from '../../viewport/subviewport/viewportBoundary';

/** A node that owns a theme, with the scope its `theme` ref resolves in. */
export interface ThemeOwner {
  node: TscnNode;
  scope: SceneScope;
}

function passesTheme(type: string): boolean {
  return descendsFromClass(type, 'Control') || descendsFromClass(type, 'Window');
}

/**
 * The owners above the viewport at `path`, nearest first. Only a window takes its parent's theme:
 * a SubViewport is neither a Control nor a Window, so its Controls start no climb.
 */
export function viewportThemeOwners(tree: LiveTree, path: string): ThemeOwner[] {
  const owners: ThemeOwner[] = [];
  if (!isEmbeddedWindow(tree.at(path)?.step.node.type ?? '')) return owners;
  for (let above = parentPathOf(path); above !== null; above = parentPathOf(above)) {
    const link = tree.at(above);
    if (!link || !passesTheme(link.step.node.type)) break;
    owners.push({ node: link.step.node, scope: link.step.scope });
  }
  return owners;
}

import { useMemo } from 'react';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext.js';
import { useCurrentCamera3D } from '../currentCamera.js';
import type { LiveTreeEntry } from '../liveSceneTree.js';
import { isClaimedByNode3DEditor } from '../nodeWorkspaceVisibility.js';
import { useLiveSceneNodes } from '../useLiveSceneTree.js';
import { isViewportBoundary } from '../viewportRender/viewportBoundary.js';
import type { TscnNode } from '../../parser/types.js';

/** What the In-game view cannot show of the game's first frame. */
export interface GameStartFacts {
  /** Nodes whose script Godot readies before the first frame (`node.cpp:273`). This view runs none. */
  scriptedNodes: number;
  /** 3D content in the root window, and no current Camera3D to draw it (`renderer_viewport.cpp:362`). */
  lacksCamera3D: boolean;
}

const holdsScript = (node: TscnNode): boolean => {
  const script = node.rawProperties.script;
  return script !== undefined && script !== 'null';
};

/** Module level, so the memo of `useLiveSceneNodes` holds. */
const isGameStartFact = (node: TscnNode): boolean =>
  holdsScript(node) || isClaimedByNode3DEditor(node.type) || isViewportBoundary(node.type);

/** `entries` from one walk of the live tree, and the root window's current Camera3D. */
export function gameStartFacts(
  entries: readonly LiveTreeEntry[],
  currentCamera3D: string | null
): GameStartFacts {
  const viewportPaths = entries.filter((e) => isViewportBoundary(e.node.type)).map((e) => `${e.path}/`);
  const isInRootWindow = (e: LiveTreeEntry) => !viewportPaths.some((viewport) => e.path.startsWith(viewport));
  const has3DContent = entries.some((e) => isClaimedByNode3DEditor(e.node.type) && isInRootWindow(e));
  return {
    scriptedNodes: entries.filter((e) => holdsScript(e.node)).length,
    lacksCamera3D: has3DContent && currentCamera3D === null,
  };
}

export function useGameStartFacts(): GameStartFacts {
  const entries = useLiveSceneNodes(isGameStartFact);
  const currentCamera3D = useCurrentCamera3D(ROOT_VIEWPORT_PATH);
  return useMemo(() => gameStartFacts(entries, currentCamera3D), [entries, currentCamera3D]);
}

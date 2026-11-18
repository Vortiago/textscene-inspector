import { useCallback } from 'react';
import { ROOT_VIEWPORT_PATH } from '../contexts/EnclosingViewportContext.js';
import { useCurrentCamera3D } from '../currentCamera.js';
import { liveTreeOf } from '../liveSceneTree.js';
import { isClaimedByNode3DEditor } from '../nodeWorkspaceVisibility.js';
import { useLiveSceneNodes, useLiveTreeSelection, type SharedLiveTree } from '../useLiveSceneTree.js';
import { keepsChildrenInViewport } from '../viewportRender/viewportBoundary.js';
import { holdsResource } from '../../godot/scene/resourceLiteral.js';
import { LOAD_OUTCOMES } from '../../resources/fileKinds.js';
import { resolveExtResourcePath } from '../../resources/SubResourceResolver.js';
import { useCachedFiles } from '../../resources/useLoadedFiles.js';
import { sameElements } from '../../utils/sameElements.js';
import type { TscnNode } from '../../parser/types.js';

/** What the In-game view cannot show of the game's first frame. */
export interface GameStartFacts {
  /** Nodes whose script Godot readies before the first frame (`node.cpp:273`). This view runs none. */
  scriptedNodes: number;
  /** 3D content in the root window, and no current Camera3D to draw it (`renderer_viewport.cpp:362`). */
  lacksCamera3D: boolean;
}

/** Module level, so the memo of `useLiveSceneNodes` holds. */
const is3DContent = (node: TscnNode): boolean => isClaimedByNode3DEditor(node.type);

const NO_SCRIPTS: readonly (string | null)[] = [];

/** The file of each script a live node holds, as its scope resolves it: null for a script in no file. */
function scriptFilesOf({ roots, ctx }: SharedLiveTree): readonly (string | null)[] {
  const files: (string | null)[] = [];
  liveTreeOf(roots, ctx).fold<void, void>(undefined, ({ raw, step }, _, descendInto) => {
    if (raw.isUnowned) return;
    const script = step.node.rawProperties.script;
    if (holdsResource(script)) files.push(resolveExtResourcePath(script, step.scope.externalResources));
    descendInto();
  });
  return files;
}

const isFile = (file: string | null): file is string => file !== null;

/** Godot readies no script whose file fails to load, so a node that names one counts for none. */
function useScriptedNodes(): number {
  const scripts = useLiveTreeSelection(scriptFilesOf, sameElements) ?? NO_SCRIPTS;
  const plan = useCallback(() => scripts.filter(isFile), [scripts]);
  const { loadedFile } = useCachedFiles(LOAD_OUTCOMES, plan);
  return scripts.filter((file) => file === null || loadedFile(file)?.isFailed !== true).length;
}

/** A script inside a SubViewport runs too, and 3D content there draws through that viewport's camera. */
export function useGameStartFacts(): GameStartFacts {
  const scriptedNodes = useScriptedNodes();
  const rootWindow3D = useLiveSceneNodes(is3DContent, keepsChildrenInViewport).length;
  const currentCamera3D = useCurrentCamera3D(ROOT_VIEWPORT_PATH);
  return { scriptedNodes, lacksCamera3D: rootWindow3D > 0 && currentCamera3D === null };
}

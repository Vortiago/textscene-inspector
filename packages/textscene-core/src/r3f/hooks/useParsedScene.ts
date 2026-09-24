/**
 * The preview shell's parse pipeline: TSCN text → `SceneGraph` or an error. `parseTscnContent` is
 * pure, so it is tested without a React tree.
 */
import { useMemo } from 'react';
import { TscnParser } from '../../parser/TscnParser.js';
import { tscnSceneToParsedScene, buildSceneGraph } from '../../core/SceneGraph.js';
import type { SceneGraph } from '../../core/SceneGraph.js';
import type { TscnScene } from '../../parser/types.js';
import { isGLBPath } from '../../resources/processing/glbProcessing.js';
import { synthesiseGLBScene } from '../../resources/processors/createSceneProcessor.js';
import { nodeComponentRegistry } from '../NodeComponentRegistry.js';

export interface ParseResult {
  sceneGraph: SceneGraph | null;
  error: string | null;
}

export function parseTscnContent(content: string, rootScenePath: string): ParseResult {
  // A top-level .glb/.gltf is not TSCN text. Synthesise the single GLBSceneRoot that
  // createSceneProcessor's instanced path uses. The node fetches the bytes through
  // useResource('GLBMesh').
  if (isGLBPath(rootScenePath)) {
    return toParseResult(rootScenePath, synthesiseGLBScene(rootScenePath));
  }
  if (!content) {
    return { sceneGraph: null, error: null };
  }
  try {
    const parser = new TscnParser();
    const tscnScene = parser.parse(content);

    // The lenient `TscnParser` salvages what it can. Text that yields zero nodes is probably a
    // broken file, so it is an error rather than "No nodes to display".
    if (tscnScene.nodes.length === 0 && content.trim().length > 0) {
      return {
        sceneGraph: null,
        error: 'Parser could not extract any nodes from the content. The file may be malformed.',
      };
    }

    return toParseResult(rootScenePath, tscnScene);
  } catch (err) {
    return {
      sceneGraph: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function toParseResult(rootScenePath: string, tscnScene: TscnScene): ParseResult {
  // Every registered `NodeComponentRegistration.scenePass`, transforms before paths, rewrites the
  // parsed tree, so render, gizmos, bounds, selection, tree and inspector read one result.
  let nodes = tscnScene.nodes;
  for (const pass of nodeComponentRegistry.scenePasses()) {
    nodes = pass(nodes, tscnScene.internalResources);
  }
  const parsedScene = tscnSceneToParsedScene(
    rootScenePath,
    nodes,
    tscnScene.externalResources,
    tscnScene.internalResources
  );
  return { sceneGraph: buildSceneGraph(parsedScene), error: null };
}

/** Re-parses only when `content` or `rootScenePath` changes. */
export function useParsedScene(content: string, rootScenePath: string): ParseResult {
  return useMemo(() => parseTscnContent(content, rootScenePath), [content, rootScenePath]);
}

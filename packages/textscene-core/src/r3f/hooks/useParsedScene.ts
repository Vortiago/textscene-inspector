/**
 * Parse pipeline for the preview shell: TSCN text → `SceneGraph` (or error).
 *
 * `parseTscnContent` is a pure function so the pipeline can be unit-tested
 * without mounting any React tree; `useParsedScene` is the thin memoizing
 * hook the shell consumes.
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
  // A .glb/.gltf opened as the top-level scene isn't TSCN text — the fetched
  // bytes are irrelevant. Synthesise the same single GLBSceneRoot the instanced
  // path uses, so it loads + renders standalone (the node re-fetches the bytes
  // via useResource('GLBMesh')). Matches createSceneProcessor's instanced path.
  if (isGLBPath(rootScenePath)) {
    return toParseResult(rootScenePath, synthesiseGLBScene(rootScenePath));
  }
  if (!content) {
    return { sceneGraph: null, error: null };
  }
  try {
    const parser = new TscnParser();
    const tscnScene = parser.parse(content);

    // The lenient `TscnParser` recovers from most malformed input by
    // returning whatever nodes it could salvage. If the body had any
    // text at all but the parser produced zero root nodes, the file is
    // probably broken — surface that as an error rather than letting
    // the user stare at "No nodes to display".
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

/** Wrap a parsed/synthesised TscnScene into a single-scene SceneGraph result. */
function toParseResult(rootScenePath: string, tscnScene: TscnScene): ParseResult {
  // Every registered scene pass, transforms before paths: a pass rewrites the
  // freshly parsed tree so render, gizmos, bounds, selection, tree and inspector
  // all read its result uniformly. See `NodeComponentRegistration.scenePass`.
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

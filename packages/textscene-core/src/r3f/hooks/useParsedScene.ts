/**
 * Parse pipeline for the preview shell: TSCN text → `SceneGraph` (or error).
 *
 * `parseTscnContent` is a pure function so the pipeline can be unit-tested
 * without mounting any React tree; `useParsedScene` is the thin memoizing
 * hook the shell consumes.
 */
import { useMemo } from 'react';
import { TscnParser } from '../../parser/TscnParser.js';
import { SceneGraphBuilder } from '../../core/SceneGraphBuilder.js';
import { tscnSceneToParsedScene } from '../../core/SceneGraph.js';
import type { SceneGraph } from '../../core/SceneGraph.js';
import type { TscnScene } from '../../parser/types.js';
import { isGLBPath } from '../../resources/processing/glbProcessing.js';
import { synthesiseGLBScene } from '../../resources/processors/createSceneProcessor.js';

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
    return buildSceneGraph(rootScenePath, synthesiseGLBScene(rootScenePath));
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
    // the user stare at "No nodes to display" (WI-R3F-7 / WEB-10).
    if (tscnScene.nodes.length === 0 && content.trim().length > 0) {
      return {
        sceneGraph: null,
        error: 'Parser could not extract any nodes from the content. The file may be malformed.',
      };
    }

    return buildSceneGraph(rootScenePath, tscnScene);
  } catch (err) {
    return {
      sceneGraph: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Assemble a single-scene SceneGraph from a parsed/synthesised TscnScene. */
function buildSceneGraph(rootScenePath: string, tscnScene: TscnScene): ParseResult {
  const parsedScene = tscnSceneToParsedScene(
    rootScenePath,
    tscnScene.nodes,
    tscnScene.externalResources,
    tscnScene.internalResources
  );
  const sceneGraph = new SceneGraphBuilder()
    .setRootScene(rootScenePath)
    .addScene(parsedScene)
    .build();
  return { sceneGraph, error: null };
}

/** Re-parses only when `content` or `rootScenePath` changes. */
export function useParsedScene(content: string, rootScenePath: string): ParseResult {
  return useMemo(() => parseTscnContent(content, rootScenePath), [content, rootScenePath]);
}

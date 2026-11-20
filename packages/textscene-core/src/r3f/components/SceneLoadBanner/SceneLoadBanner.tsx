import { useMemo } from 'react';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { sceneFailingReads } from '../../../resources/loadFailure/fileReads.js';
import { useSceneFiles } from '../../hooks/useSceneFiles.js';
import { resourceFilePath } from '../../../resources/subResourcePath.js';
import { failureChainText, godotFailureLine } from '../../../resources/loadFailure/failureText.js';
import type { ParsedScene } from '../../../core/SceneGraph.js';
import styles from './SceneLoadBanner.module.css';

const NO_SCENE: ParsedScene = { path: '', nodes: [], internalResources: [], externalResources: [] };

/** Shows the first file whose failure fails the scene, as Godot refuses it (resource_format_text.cpp:647-650). */
export function SceneLoadBanner() {
  const hierarchy = useOptionalHierarchy();
  const sceneGraph = hierarchy?.sceneGraph;
  const scene = sceneGraph?.scenes?.get(sceneGraph.rootScene) ?? NO_SCENE;
  const reads = useMemo(() => sceneFailingReads(scene.path, scene), [scene]);
  const files = useSceneFiles(hierarchy?.scene);
  const failure = reads.flatMap(
    (read) => files.find((file) => file.path === resourceFilePath(read))?.reason ?? []
  )[0];
  if (!failure) return null;
  return (
    <div className={styles.banner} role="alert" data-testid="scene-load-banner">
      <div className={styles.title}>The game would fail to load this scene</div>
      <code className={styles.line}>{godotFailureLine(scene, failure.chain[0]!)}</code>
      <div className={styles.chain}>{failureChainText([scene.path, ...failure.chain], failure.cause)}</div>
    </div>
  );
}

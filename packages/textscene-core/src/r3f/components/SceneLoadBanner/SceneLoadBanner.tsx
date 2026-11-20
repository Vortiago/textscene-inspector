import { useMemo } from 'react';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { sceneFailingReads } from '../../../resources/loadFailure/fileReads.js';
import { useSceneFiles } from '../../hooks/useSceneFiles.js';
import { resourceFilePath } from '../../../resources/subResourcePath.js';
import { failureChainText, godotFailureLine } from '../../../resources/loadFailure/failureText.js';
import type { ParsedScene } from '../../../core/SceneGraph.js';
import type { SceneFile, SceneFileFailure } from '../../../scene/sceneFiles.js';
import styles from './SceneLoadBanner.module.css';

const NO_SCENE: ParsedScene = { path: '', nodes: [], internalResources: [], externalResources: [] };

/** The first file whose failure fails the scene (resource_format_text.cpp:647-650). */
export function SceneLoadBanner() {
  const hierarchy = useOptionalHierarchy();
  const sceneGraph = hierarchy?.sceneGraph;
  const scene = sceneGraph?.scenes?.get(sceneGraph.rootScene) ?? NO_SCENE;
  const reads = useMemo(() => sceneFailingReads(scene.path, scene), [scene]);
  const files = useSceneFiles(hierarchy?.scene);
  const failure = useMemo(() => firstFailure(reads, files), [reads, files]);
  if (!failure) return null;
  return (
    <div className={styles.banner} role="alert" data-testid="scene-load-banner">
      <div className={styles.title}>The game would fail to load this scene</div>
      <code className={styles.line}>{godotFailureLine(scene, failure.chain[0]!)}</code>
      <div className={styles.chain}>{failureChainText([scene.path, ...failure.chain], failure.cause)}</div>
    </div>
  );
}

function firstFailure(reads: readonly string[], files: readonly SceneFile[]): SceneFileFailure | null {
  const reasons = new Map(files.map((file) => [file.path, file.reason]));
  for (const read of reads) {
    const reason = reasons.get(resourceFilePath(read));
    if (reason && failsRead(reason, read)) return reason;
  }
  return null;
}

/** A failed load fails each read of the file, and an undeclared address only the read that names it. */
function failsRead({ chain }: SceneFileFailure, read: string): boolean {
  const failedFirst = chain[0]!;
  return failedFirst === resourceFilePath(failedFirst) || failedFirst === read;
}

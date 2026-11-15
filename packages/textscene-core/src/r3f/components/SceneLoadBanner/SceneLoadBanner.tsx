import { useMemo } from 'react';
import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { sceneFailingReads } from '../../../resources/loadFailure/failingReads.js';
import { useFirstLoadFailure } from '../../../resources/loadFailure/useFirstLoadFailure.js';
import { failureChainText, godotFailureLine } from '../../../resources/loadFailure/failureText.js';
import type { ParsedScene } from '../../../core/SceneGraph.js';
import styles from './SceneLoadBanner.module.css';

const NO_SCENE: ParsedScene = { path: '', nodes: [], internalResources: [], externalResources: [] };

export function SceneLoadBanner() {
  const sceneGraph = useOptionalHierarchy()?.sceneGraph;
  const scene = sceneGraph?.scenes?.get(sceneGraph.rootScene) ?? NO_SCENE;
  const reads = useMemo(() => sceneFailingReads(scene.path, scene), [scene]);
  const failure = useFirstLoadFailure(reads);
  if (!failure) return null;
  return (
    <div className={styles.banner} role="alert" data-testid="scene-load-banner">
      <div className={styles.title}>The game would fail to load this scene</div>
      <code className={styles.line}>{godotFailureLine(scene, failure.chain[0]!)}</code>
      <div className={styles.chain}>{failureChainText([scene.path, ...failure.chain], failure.cause)}</div>
    </div>
  );
}

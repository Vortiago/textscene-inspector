import { useOptionalHierarchy } from '../../contexts/HierarchyContext.js';
import { useSceneFiles } from '../../hooks/useSceneFiles.js';
import { failureChainText } from '../../../resources/loadFailure/failureText.js';
import styles from './SceneLoadBanner.module.css';

/** The failure through which the game refuses the scene (resource_format_text.cpp:647-650). */
export function SceneLoadBanner() {
  const scene = useOptionalHierarchy()?.scene;
  const file = useSceneFiles(scene).find((row) => row.sceneFailure);
  if (!scene || !file?.sceneFailure || !file.reason) return null;
  const { line, chain } = file.sceneFailure;
  return (
    <div className={styles.banner} role="alert" data-testid="scene-load-banner">
      <div className={styles.title}>The game would fail to load this scene</div>
      <code className={styles.line}>{line}</code>
      <div className={styles.chain}>
        {failureChainText([scene.rootScenePath, ...chain], file.reason.cause)}
      </div>
    </div>
  );
}

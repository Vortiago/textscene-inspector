/**
 * <TscnCanvas> — the top-level React component for rendering a parsed
 * TSCN scene under react-three-fiber. WI-R3F-1 lands an empty canvas
 * with default lighting only; node-type children arrive in WI-R3F-3.
 */
import { Canvas } from '@react-three/fiber';
import styles from './TscnCanvas.module.css';

export interface TscnCanvasProps {
  // Will accept SceneGraph in WI-R3F-3. Empty for now so both host
  // apps can mount the canvas behind a feature flag and verify the
  // R3F runtime is wired up correctly.
}

/**
 * The contents of the R3F scene (everything that would normally live
 * inside `<Canvas>`). Exported separately so `@react-three/test-renderer`
 * can mount it directly — the test renderer is the canvas substitute
 * and cannot wrap a real `<Canvas>` host.
 */
export function TscnSceneContents(_props: TscnCanvasProps) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
    </>
  );
}

export function TscnCanvas(props: TscnCanvasProps) {
  return (
    <div className={styles.root}>
      <Canvas camera={{ position: [3, 3, 3] }}>
        <TscnSceneContents {...props} />
      </Canvas>
    </div>
  );
}

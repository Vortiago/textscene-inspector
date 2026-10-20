/** Hands a test the canvas's renderer, which the test renderer does not expose. */
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';

export function CaptureRenderer({ captured }: { captured: { current: THREE.WebGLRenderer | null } }) {
  captured.current = useThree((state) => state.gl);
  return null;
}

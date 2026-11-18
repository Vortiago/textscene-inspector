import { useThree } from '@react-three/fiber';

/** The canvas in device pixels, floored as three floors its buffer (r187 `WebGLRenderer.js:713`). */
export function useDrawingBufferSize(): { width: number; height: number } {
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);
  return { width: Math.floor(size.width * dpr), height: Math.floor(size.height * dpr) };
}

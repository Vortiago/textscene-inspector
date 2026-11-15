import type * as THREE from 'three';
import type { CanvasProps } from '@react-three/fiber';
import { prepareCanvasRenderer } from './prepareCanvasRenderer.js';

// `percentage` is `THREE.PCFShadowMap`, and `flat` leaves every tone curve to the compositor.
export const CANVAS_RENDERER_PROPS = {
  shadows: 'percentage',
  flat: true,
  onCreated: prepareCanvasRenderer,
} as const satisfies Pick<CanvasProps, 'shadows' | 'flat' | 'onCreated'>;

// A ScrollContainer clips through `clippingPlanes`, and MSAA comes from a target, never the buffer (ADR-0052).
export const CANVAS_RENDERER_GL = {
  localClippingEnabled: true,
  antialias: false,
} as const satisfies THREE.WebGLRendererParameters &
  Partial<Pick<THREE.WebGLRenderer, 'localClippingEnabled'>>;

/** The `<Canvas>` props every canvas of the preview takes, whatever it draws. */

import type { CanvasProps } from '@react-three/fiber';
import { prepareCanvasRenderer } from './prepareCanvasRenderer.js';

/**
 * `shadows`: R3F leaves the shadow map off without it, so a 3D SubViewport on a 2D canvas would draw
 * no shadow. `percentage` selects `THREE.PCFShadowMap`, the soft-shadow type three 0.187 draws.
 * `flat`: the compositor applies every curve, and Godot never tone-maps 2D colour, so three adds none
 * of its own where R3F would apply ACES.
 */
export const CANVAS_RENDERER_PROPS = {
  shadows: 'percentage',
  flat: true,
  onCreated: prepareCanvasRenderer,
} as const satisfies Pick<CanvasProps, 'shadows' | 'flat' | 'onCreated'>;

/**
 * `localClippingEnabled`: three ignores a `clippingPlanes` array without it, and a ScrollContainer
 * clips through one on either canvas. `antialias: false`: `msaa_2d` and `msaa_3d` default to
 * Disabled (`viewport.h:309`, `rendering_server.cpp:3774`). MSAA never comes from the drawing
 * buffer (ADR-0052): a project that turns it on gets a multisampled target.
 */
export const CANVAS_RENDERER_GL = {
  localClippingEnabled: true,
  antialias: false,
} as const;

/** The vendored node icons: one SVG of Godot's 128 px size for each node type the editor draws one for. */

import { describe, expect, it } from 'vitest';
import { editorIconDataUrl, type EditorIconName } from './editorIcons';

// The `editor/icons/Gizmo*.svg` files of Godot 4.6.3.
const GODOT_ICON_NAMES: readonly EditorIconName[] = [
  'Gizmo3DSamplePlayer',
  'GizmoAudioListener3D',
  'GizmoCPUParticles3D',
  'GizmoCamera3D',
  'GizmoDecal',
  'GizmoDirectionalLight',
  'GizmoFogVolume',
  'GizmoGPUParticles3D',
  'GizmoLight',
  'GizmoLightmapGI',
  'GizmoLightmapProbe',
  'GizmoReflectionProbe',
  'GizmoSpotLight',
  'GizmoVoxelGI',
];

function decodedSvg(name: EditorIconName): string {
  const [header, base64] = editorIconDataUrl(name).split(',');
  expect(header).toBe('data:image/svg+xml;base64');
  return Buffer.from(base64!, 'base64').toString('utf8');
}

describe('editorIconDataUrl', () => {
  it.each(GODOT_ICON_NAMES)('decodes %s to an SVG of 128 by 128 pixels', (name) => {
    const svg = decodedSvg(name);
    expect(svg).toMatch(/^<svg [^>]*width="128" height="128"/);
  });
});

import { render, screen } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import '../../sceneLiveTree';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { MissingResourcesProvider } from '../../contexts/MissingResourcesContext';
import { openScene, type Scene } from '../../../scene/openScene';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import { MissingResourcesPanel, type MissingResourcesPanelProps } from './MissingResourcesPanel';

export const MAIN = 'res://main.tscn';

/** A provider that answers the files it holds now, and lists no folder. */
export function filesOf(files: Record<string, string | ArrayBuffer>): ResourceProvider {
  return { loadResource: async (path) => files[path] ?? null };
}

/** A scene whose root reads each path through a Sprite2D's texture. */
export function sceneReading(paths: readonly string[]): string {
  const exts = paths.map((path, index) => `[ext_resource type="Texture2D" path="${path}" id="${index}"]`);
  const sprites = paths.map(
    (_, index) => `[node name="S${index}" type="Sprite2D" parent="."]\ntexture = ExtResource("${index}")`
  );
  return ['[gd_scene format=3]', ...exts, '[node name="Main" type="Node2D"]', ...sprites].join('\n\n') + '\n';
}

interface MountedPanel {
  scene: Scene;
  panel: HTMLElement;
  onUpload: Mock<MissingResourcesPanelProps['onUpload']>;
  onRemove: Mock<MissingResourcesPanelProps['onRemove']>;
}

/** The panel over a scene of `source`, once its first row shows. */
export async function mountPanel(source: string, provider: ResourceProvider): Promise<MountedPanel> {
  const scene = openScene({ source, provider, rootScenePath: MAIN });
  const onUpload = vi.fn<MissingResourcesPanelProps['onUpload']>();
  const onRemove = vi.fn<MissingResourcesPanelProps['onRemove']>();
  render(
    <HierarchyProvider value={{ sceneGraph: null, panelId: 'p', scene }}>
      <MissingResourcesProvider>
        <MissingResourcesPanel onUpload={onUpload} onRemove={onRemove} />
      </MissingResourcesProvider>
    </HierarchyProvider>
  );
  const panel = await screen.findByTestId('missing-resources-panel');
  return { scene, panel, onUpload, onRemove };
}

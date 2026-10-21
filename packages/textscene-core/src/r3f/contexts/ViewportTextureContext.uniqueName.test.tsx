/**
 * Two `<SubViewport>`s claim one `%Name`. `_acquire_unique_name_in_owner` keeps
 * the first claimant and clears the later node's flag (node.cpp:2225-2231), so a
 * consumer's `NodePath("%View")` walks through its claim table to the first one.
 */
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.testkit.js';
import { TscnParser } from '../../parser/TscnParser.js';
import { HierarchyProvider } from './HierarchyContext.js';
import { viewportTextureRegistryKey } from '../viewportTexturePath.js';
import { useLocalScene } from '../useUniqueNames.js';
import {
  ViewportTextureProvider,
  useViewportTexture,
  type ViewportTextureEntry,
} from './ViewportTextureContext.js';
import { ViewportTexturePublisher, viewportEntry } from '../testing/ViewportTexturePublisher';

/** Root/Ui/View and Root/Hud/View, in that declaration order. */
const SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Ui" type="Node2D" parent="."]

[node name="Hud" type="Node2D" parent="."]

[node name="View" type="SubViewport" parent="Ui"]
unique_name_in_owner = true

[node name="View" type="SubViewport" parent="Hud"]
unique_name_in_owner = true
`;

// The real builder, not a cast literal, which keeps compiling after
// `SceneGraph` gains a field and stops matching what the `%Name` claim hooks read.
const graph = createSceneGraphFromTscnScene(new TscnParser().parse(SCENE));

const entry = (id: string): ViewportTextureEntry =>
  viewportEntry({ name: id } as THREE.Texture, { x: 4, y: 4 });

const winner = entry('ui');
const loser = entry('hud');

function wrapper({ children }: { children: ReactNode }) {
  return (
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'panel' }}>
      <ViewportTextureProvider>
        <ViewportTexturePublisher path="Root/Ui/View" entry={winner} />
        <ViewportTexturePublisher path="Root/Hud/View" entry={loser} />
        {children}
      </ViewportTextureProvider>
    </HierarchyProvider>
  );
}

/** The texture a consumer at `Root/Ui` reaches through `viewport_path`, as a texture slot walks it. */
function useConsumedTexture(viewportPath: string): ViewportTextureEntry | null {
  const localScene = useLocalScene('Root/Ui');
  return useViewportTexture(
    viewportTextureRegistryKey(localScene?.path ?? null, viewportPath, localScene?.uniquePaths)
  );
}

describe('a %Name two sub-viewports both claim', () => {
  it('resolves to the first claimant, not to whichever published last', () => {
    const { result } = renderHook(() => useConsumedTexture('%View'), { wrapper });
    expect(result.current).toBe(winner);
  });

  it('still reaches the later one by its own path', () => {
    // Only its flag is cleared, so `Root/Hud/View` still addresses it.
    const { result } = renderHook(() => useViewportTexture('Root/Hud/View'), { wrapper });
    expect(result.current).toBe(loser);
  });
});

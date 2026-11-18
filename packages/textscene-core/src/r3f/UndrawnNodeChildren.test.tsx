/**
 * The viewports below a node the workspace does not draw still take their place in tree order, so
 * their passes draw in Godot's order and not in the order they register.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect } from 'react';
import { TscnParser } from '../parser/TscnParser';
import { UndrawnNodeChildren } from './UndrawnNodeChildren';
import {
  ViewportPassOrchestrator,
  ViewportPassProvider,
  useRegisterViewportPass,
  type ViewportPass,
} from './contexts/ViewportPassRegistryContext';

const SCENE = `[gd_scene format=3]

[node name="Panel" type="Control"]

[node name="Early" type="SubViewport" parent="."]

[node name="Box" type="Control" parent="."]

[node name="Late" type="SubViewport" parent="Box"]
`;

function Registrar({ path, pass }: { path: string; pass: ViewportPass }) {
  const register = useRegisterViewportPass();
  useEffect(() => register(path, pass), [register, path, pass]);
  return null;
}

describe('UndrawnNodeChildren', () => {
  it('places the viewports below an undrawn node in tree order', async () => {
    const panel = new TscnParser().parse(SCENE).nodes[0]!;
    const order: string[] = [];
    const renderer = await ReactThreeTestRenderer.create(
      <ViewportPassProvider>
        <Registrar path="Panel/Box/Late" pass={{ dependsOn: [], render: () => order.push('Late') }} />
        <Registrar path="Panel/Early" pass={{ dependsOn: [], render: () => order.push('Early') }} />
        <UndrawnNodeChildren node={panel} path="Panel" />
        <ViewportPassOrchestrator />
      </ViewportPassProvider>
    );
    await renderer.advanceFrames(1, 16);
    expect(order).toEqual(['Early', 'Late']);
  });
});

/**
 * The preview sun and sky toggles, which Godot disables when the scene
 * supplies its own: `sun_button->set_disabled(directional_light_count > 0);`
 * The two are separate controls, and the disabled one says why.
 */

import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ViewportModeProvider } from '../../contexts/ViewportModeContext';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import { TscnParser } from '../../../parser/TscnParser';
import { ViewportToolbar } from './ViewportToolbar';
import { openDisplayMenu } from './displayMenuTesting';

function renderWithScene(body: string) {
  const graph = createSceneGraphFromTscnScene(
    new TscnParser().parse(`[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n${body}`)
  );
  const result = render(
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <ViewportModeProvider>
        <ViewportToolbar />
      </ViewportModeProvider>
    </HierarchyProvider>
  );
  openDisplayMenu();
  return result;
}

const sun = () => screen.getByLabelText('Preview Sun') as HTMLInputElement;
const sky = () => screen.getByLabelText('Preview Sky') as HTMLInputElement;

describe('preview lighting toggles', () => {
  it('offers both, checked, for a scene that supplies neither', () => {
    renderWithScene('\n[node name="Cube" type="MeshInstance3D" parent="."]\n');
    expect(sun().checked).toBe(true);
    expect(sun().disabled).toBe(false);
    expect(sky().checked).toBe(true);
    expect(sky().disabled).toBe(false);
  });

  it('turns the preview sun off and on again', () => {
    renderWithScene('\n[node name="Cube" type="MeshInstance3D" parent="."]\n');
    fireEvent.click(sun());
    expect(sun().checked).toBe(false);
    // The sky is a separate control and must not have followed.
    expect(sky().checked).toBe(true);
    fireEvent.click(sun());
    expect(sun().checked).toBe(true);
  });

  it('disables the sun — and only the sun — for a scene with a DirectionalLight3D', () => {
    renderWithScene('\n[node name="Sun" type="DirectionalLight3D" parent="."]\n');
    expect(sun().disabled).toBe(true);
    expect(sun().checked).toBe(false);
    expect(sky().disabled).toBe(false);
    expect(sky().checked).toBe(true);
  });

  it('disables the sky — and only the sky — for a scene with a WorldEnvironment', () => {
    renderWithScene('\n[node name="WorldEnvironment" type="WorldEnvironment" parent="."]\n');
    expect(sky().disabled).toBe(true);
    expect(sky().checked).toBe(false);
    expect(sun().disabled).toBe(false);
    expect(sun().checked).toBe(true);
  });

  it('says why a preview is unavailable', () => {
    renderWithScene('\n[node name="Sun" type="DirectionalLight3D" parent="."]\n');
    expect(sun().closest('label')?.getAttribute('title')).toMatch(/contains DirectionalLight3D/);
  });

  it('hides both in 2D — there is no 3D lighting to preview', () => {
    render(
      <ViewportModeProvider initialMode="2D">
        <ViewportToolbar />
      </ViewportModeProvider>
    );
    // Open, since a closed popover lacks them either way.
    openDisplayMenu();
    expect(screen.queryByLabelText('Preview Sun')).toBeNull();
    expect(screen.queryByLabelText('Preview Sky')).toBeNull();
  });
});

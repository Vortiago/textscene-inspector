import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// happy-dom has no WebGL. The stub shows what the shell hands its view.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: ({ camera }: { camera?: string | null }) => (
    <div data-testid="view" data-camera={camera === undefined ? 'undefined' : String(camera)} />
  ),
}));

import { TextShell } from './TscnPreviewShell.testkit';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Eye" type="Camera3D" parent="."]
`;

const OTHER_SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Eye" type="Camera3D" parent="."]

[node name="Box" type="Node3D" parent="."]
`;

const viewCamera = () => screen.getByTestId('view').dataset.camera;

describe('<TextShell> the camera it hands its view', () => {
  it('hands the editor camera, null, until a camera is previewed', async () => {
    render(<TextShell panelId="cam-none" content={SCENE} initialViewportMode="3D" />);
    await screen.findAllByText('Main');
    expect(viewCamera()).toBe('null');
  });

  it("hands a deep link's camera by its absolute path", async () => {
    render(
      <TextShell
        panelId="cam-link"
        content={SCENE}
        initialViewportMode="3D"
        initialPreviewedCameraPath="Main/Eye"
      />
    );
    await screen.findAllByText('Main');
    expect(viewCamera()).toBe('/root/Main/Eye');
  });

  it('hands the camera a Cameras panel row previews', async () => {
    render(<TextShell panelId="cam-row" content={SCENE} initialViewportMode="3D" />);
    fireEvent.click(await screen.findByRole('tab', { name: /Cameras/ }));

    fireEvent.click(screen.getByRole('button', { name: /^Eye/ }));

    expect(viewCamera()).toBe('/root/Main/Eye');
  });

  it('hands the editor camera again after a scene change', async () => {
    const { rerender } = render(
      <TextShell
        panelId="cam-switch"
        content={SCENE}
        initialViewportMode="3D"
        initialPreviewedCameraPath="Main/Eye"
      />
    );
    await screen.findAllByText('Main');

    await act(async () =>
      rerender(
        <TextShell
          panelId="cam-switch"
          content={OTHER_SCENE}
          initialViewportMode="3D"
          initialPreviewedCameraPath="Main/Eye"
        />
      )
    );

    expect(viewCamera()).toBe('null');
  });
});

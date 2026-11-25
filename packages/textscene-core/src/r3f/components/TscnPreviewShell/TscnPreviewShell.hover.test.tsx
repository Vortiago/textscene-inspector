import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NodeHandle } from '../../../scene/nodeHandle';

const view = vi.hoisted(() => ({ selected: undefined as NodeHandle | null | undefined }));

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: (props: { selected?: NodeHandle | null }) => {
    view.selected = props.selected;
    return <canvas data-testid="view" tabIndex={-1} />;
  },
}));

import { openScene } from '../../../scene/openScene';
import { useAnimationTransport } from '../../contexts/AnimationTransportContext';
import { TscnPreviewShell } from './TscnPreviewShell';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Box" type="Node3D" parent="."]

[node name="Lamp" type="OmniLight3D" parent="."]
`;

function row(path: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-node-path="${path}"] > [role="treeitem"]`);
  if (!found) throw new Error(`expected a row for ${path}, found none`);
  return found;
}

async function renderShell() {
  const scene = openScene({ source: SCENE, provider: { loadResource: async () => null } });
  render(<TscnPreviewShell panelId="hover" scene={scene} initialViewportMode="3D" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Expand all' }));
  return scene;
}

// The view has one outline colour, so a hovered row becomes the view's `selected`.
describe('<TscnPreviewShell> a hovered tree row', () => {
  it('hands the view the hovered node as selected', async () => {
    await renderShell();

    act(() => fireEvent.mouseEnter(row('Main/Lamp')));

    expect(view.selected?.path).toBe('/root/Main/Lamp');
  });

  it('takes the keys from a focused view, so its F never frames the hovered node', async () => {
    await renderShell();
    const canvas = screen.getByTestId('view');
    canvas.focus();

    act(() => fireEvent.mouseEnter(row('Main/Lamp')));

    expect(document.activeElement).not.toBe(canvas);
  });

  it('leaves the focus of a row the keyboard moved to', async () => {
    await renderShell();
    row('Main/Box').focus();

    act(() => fireEvent.mouseEnter(row('Main/Lamp')));

    expect(document.activeElement).toBe(row('Main/Box'));
  });

  it('hands the view the clicked node again when the view takes focus under a hovered row', async () => {
    await renderShell();
    fireEvent.click(row('Main/Box'));
    act(() => fireEvent.mouseEnter(row('Main/Lamp')));

    act(() => screen.getByTestId('view').focus());

    expect(view.selected?.path).toBe('/root/Main/Box');
  });

  it('hands the view the clicked node again when the pointer leaves', async () => {
    await renderShell();
    fireEvent.click(row('Main/Box'));
    act(() => fireEvent.mouseEnter(row('Main/Lamp')));

    act(() => fireEvent.mouseLeave(row('Main/Lamp')));

    expect(view.selected?.path).toBe('/root/Main/Box');
  });

  it('keeps the clicked row selected in the tree while another row is hovered', async () => {
    await renderShell();
    fireEvent.click(row('Main/Box'));

    act(() => fireEvent.mouseEnter(row('Main/Lamp')));

    expect(row('Main/Box').getAttribute('aria-selected')).toBe('true');
    expect(row('Main/Lamp').getAttribute('aria-selected')).toBe('false');
  });

  it('keeps the clicked node in the inspector while another row is hovered', async () => {
    await renderShell();
    fireEvent.click(row('Main/Box'));
    await screen.findByRole('heading', { level: 3, name: 'Box' });

    await act(async () => fireEvent.mouseEnter(row('Main/Lamp')));

    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Box');
  });

  it('hands the view no node once a new scene replaces the hovered row', async () => {
    const scene = openScene({ source: SCENE, provider: { loadResource: async () => null } });
    const { rerender } = render(<TscnPreviewShell panelId="hover" scene={scene} initialViewportMode="3D" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Expand all' }));
    act(() => fireEvent.mouseEnter(row('Main/Lamp')));
    const next = openScene({ source: SCENE, provider: { loadResource: async () => null } });

    rerender(<TscnPreviewShell panelId="hover" scene={next} initialViewportMode="3D" />);

    expect(view.selected).toBeNull();
  });
});

describe('<TscnPreviewShell> the node the animation transport drives', () => {
  it('is the clicked node, not the hovered one', async () => {
    let activePath: string | null | undefined;
    function TransportProbe() {
      activePath = useAnimationTransport().activePath;
      return null;
    }
    const scene = openScene({ source: SCENE, provider: { loadResource: async () => null } });
    render(
      <TscnPreviewShell
        panelId="hover-transport"
        scene={scene}
        initialViewportMode="3D"
        toolbar={<TransportProbe />}
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Expand all' }));
    fireEvent.click(row('Main/Box'));

    act(() => fireEvent.mouseEnter(row('Main/Lamp')));

    expect(activePath).toBe('Main/Box');
  });
});

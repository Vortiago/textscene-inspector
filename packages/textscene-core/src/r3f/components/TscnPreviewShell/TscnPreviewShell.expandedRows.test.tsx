import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NodeHandle } from '../../../scene/nodeHandle';

/** Picks the node at a live path as a click in the view does. Written by the canvas stub on each render. */
let pickInView: (path: string) => void = () => {};

vi.mock('../../TscnCanvas', async () => {
  const { useOptionalHierarchy } = await import('../../contexts/HierarchyContext');
  const { absolutePathOf } = await import('../../../scene/nodePathWalk');
  return {
    TscnCanvas: ({ onSelect }: { onSelect?: (node: NodeHandle | null) => void }) => {
      const scene = useOptionalHierarchy()?.scene;
      pickInView = (path) => onSelect?.(scene?.getNodeOrNull(absolutePathOf(path)) ?? null);
      return <div data-testid="canvas-stub" />;
    },
  };
});

import { TextShell } from './TscnPreviewShell.testkit';

const NESTED = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Arm" type="Node3D" parent="."]

[node name="Hand" type="Node3D" parent="Arm"]
`;

const NESTED_EDITED = `${NESTED}
[node name="Foot" type="Node3D" parent="."]
`;

const isExpanded = (container: HTMLElement, path: string) =>
  container.querySelector(`[data-node-path="${path}"] [aria-expanded="true"]`) !== null;

describe('<TextShell> expanded tree rows', () => {
  it('expands the ancestors of a node picked in the view', async () => {
    const { container } = render(<TextShell panelId="p1" content={NESTED} />);
    await screen.findByText('Root');
    expect(isExpanded(container, 'Root/Arm')).toBe(false);

    act(() => pickInView('Root/Arm/Hand'));

    expect(isExpanded(container, 'Root')).toBe(true);
    expect(isExpanded(container, 'Root/Arm')).toBe(true);
  });

  it('keeps a row collapsed by hand while the selection stays', async () => {
    const { container } = render(<TextShell panelId="p1" content={NESTED} />);
    await screen.findByText('Root');
    act(() => pickInView('Root/Arm/Hand'));
    const chevron = container.querySelector('[data-node-path="Root/Arm"] [class*=expandIcon]') as HTMLElement;

    await act(async () => userEvent.click(chevron));

    expect(isExpanded(container, 'Root/Arm')).toBe(false);
  });

  it('collapses every row for a new parse, though the same paths come back', async () => {
    const { container, rerender } = render(<TextShell panelId="p1" content={NESTED} />);
    await screen.findByText('Root');
    act(() => pickInView('Root/Arm/Hand'));
    expect(isExpanded(container, 'Root/Arm')).toBe(true);

    rerender(<TextShell panelId="p1" content={NESTED_EDITED} />);

    await waitFor(() => expect(isExpanded(container, 'Root')).toBe(false));
  });
});

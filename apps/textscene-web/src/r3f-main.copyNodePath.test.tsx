/** The Inspector's "Copy node path" button writes through the browser clipboard. */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { R3FApp } from './r3f-main';

const TSCN = `[gd_scene load_steps=1 format=3]

[node name="StubRoot" type="Node3D"]

[node name="Child" type="Node3D" parent="."]
`;

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  globalThis.localStorage?.clear();
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(TSCN),
  } as unknown as Response) as unknown as typeof fetch;
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function copyRootPath(): Promise<void> {
  render(<R3FApp />);
  const rootRow = (await screen.findByText('StubRoot')).closest('[data-node-path]') as HTMLElement;
  fireEvent.click(within(rootRow).getByRole('button', { name: 'Expand' }));
  await screen.findByText('Child');
  fireEvent.click(screen.getByText('StubRoot'));
  fireEvent.click(await screen.findByRole('button', { name: 'Copy node path' }));
}

describe('copy node path in the web previewer', () => {
  it('logs, and does not throw, where the browser has no clipboard', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    await copyRootPath();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('writes "." for the scene root through navigator.clipboard', async () => {
    await copyRootPath();
    expect(writeText).toHaveBeenCalledExactlyOnceWith('.');
  });
});

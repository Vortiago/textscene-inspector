import { StrictMode, type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

const rendered: ReactElement[] = [];

vi.mock('react-dom/client', () => ({
  createRoot: () => ({ render: (element: ReactElement) => rendered.push(element) }),
}));

import { mountR3F } from './r3f-main';

describe('mountR3F', () => {
  it('mounts the app under StrictMode', () => {
    mountR3F(document.createElement('div'));

    expect(rendered.map((element) => element.type)).toEqual([StrictMode]);
  });
});

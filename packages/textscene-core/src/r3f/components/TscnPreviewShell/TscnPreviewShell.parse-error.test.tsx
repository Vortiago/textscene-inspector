/**
 * With a parse error in the banner, the tree pane shows a message that points
 * at the banner, not its "Loading scene…" state, which looks like a hang.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

// The lenient parser extracts no node from this body, which takes the
// "Parser could not extract any nodes from the content" error path.
const MALFORMED_TSCN = '[this is { not valid tscn at all';

describe('<TscnPreviewShell> parse-error empty state (WI-UX-4 / Gap 7)', () => {
  it('shows the parse-error banner', () => {
    render(<TscnPreviewShell panelId="parse-err" content={MALFORMED_TSCN} />);
    const banner = screen.getByRole('alert');
    expect(banner.textContent).toMatch(/Parse error|Parser could not extract/i);
  });

  it('does not render the "Loading scene…" tree-pane empty state when there is a parse error', () => {
    render(<TscnPreviewShell panelId="parse-err" content={MALFORMED_TSCN} />);
    expect(screen.queryByText(/Loading scene/i)).toBeNull();
  });

  it('renders the dedicated empty-state copy pointing at the banner', () => {
    render(<TscnPreviewShell panelId="parse-err" content={MALFORMED_TSCN} />);
    expect(screen.getByText(/No scene loaded/i)).toBeTruthy();
    expect(screen.getByText(/fix the parse error/i)).toBeTruthy();
  });
});

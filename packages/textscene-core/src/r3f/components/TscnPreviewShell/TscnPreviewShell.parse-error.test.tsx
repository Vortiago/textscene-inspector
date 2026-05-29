/**
 * WI-UX-4 (Gap 7): when a parse error is shown in the banner, the tree
 * pane must not present its "Loading scene…" empty state — that looks
 * like a hang. A dedicated empty-state message points the user at the
 * actionable banner instead.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

// Non-empty body that the lenient parser can't extract any nodes from —
// triggers the "Parser could not extract any nodes from the content"
// error path that previously also left the tree pane stuck on the
// "Loading scene…" indicator.
const MALFORMED_TSCN = '[this is { not valid tscn at all';

describe('<TscnPreviewShell> parse-error empty state (WI-UX-4 / Gap 7)', () => {
  it('shows the parse-error banner', () => {
    render(<TscnPreviewShell panelId="parse-err" content={MALFORMED_TSCN} />);
    const banner = screen.getByRole('alert');
    expect(banner.textContent).toMatch(/Parse error|Parser could not extract/i);
  });

  it('does not render the "Loading scene…" tree-pane empty state when there is a parse error', () => {
    render(<TscnPreviewShell panelId="parse-err" content={MALFORMED_TSCN} />);
    // The previous behaviour mounted <SceneTreeViewer> with sceneGraph=null,
    // which fell through to that component's "Loading scene…" branch.
    // Post-fix the shell substitutes a dedicated empty-state message.
    expect(screen.queryByText(/Loading scene/i)).toBeNull();
  });

  it('renders the dedicated empty-state copy pointing at the banner', () => {
    render(<TscnPreviewShell panelId="parse-err" content={MALFORMED_TSCN} />);
    expect(screen.getByText(/No scene loaded/i)).toBeTruthy();
    expect(screen.getByText(/fix the parse error/i)).toBeTruthy();
  });
});

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelpLink } from './HelpLink';

describe('<HelpLink> (#224)', () => {
  it('renders an external link to the README documentation section', () => {
    render(<HelpLink />);
    const link = screen.getByRole('link', { name: /help and documentation/i });
    expect(link.getAttribute('href')).toBe(
      'https://github.com/Vortiago/textscene-inspector#documentation'
    );
  });

  it('opens in a new tab without leaking a window.opener reference', () => {
    render(<HelpLink />);
    const link = screen.getByRole('link', { name: /help and documentation/i });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('shows a compact "?" glyph', () => {
    render(<HelpLink />);
    expect(screen.getByRole('link', { name: /help and documentation/i }).textContent).toBe('?');
  });
});

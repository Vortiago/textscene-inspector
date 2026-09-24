/**
 * The file-level section on its own: its dot and count, and the popover that hover, focus,
 * a click and Escape open and close. `r3f-main.file-problems.test.tsx` tests it in the pane.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FileProblems } from './FileProblems';
import type { DiagnosticGroup } from './lineDiagnostics';

const GROUP: DiagnosticGroup = { severity: 'warning', messages: ['first finding', 'second finding'] };

function section() {
  return screen.getByTestId('file-problems');
}

function popover() {
  return screen.queryByTestId('file-problems-popover');
}

describe('FileProblems', () => {
  it('shows a dot for the highest severity and the number of findings, with the popover closed', () => {
    render(<FileProblems group={GROUP} />);

    expect(section().textContent).toBe('File-level2');
    expect(section().querySelector('[aria-hidden="true"]')?.className).toMatch(/warning/i);
    expect(popover()).toBeNull();
  });

  it('lists every message, in order, while the pointer is over it', () => {
    render(<FileProblems group={GROUP} />);

    fireEvent.mouseEnter(section());
    expect([...popover()!.children].map((row) => row.textContent)).toEqual(GROUP.messages);

    fireEvent.mouseLeave(section());
    expect(popover()).toBeNull();
  });

  it('opens on keyboard focus and describes the button with the popover, then closes on blur', () => {
    render(<FileProblems group={GROUP} />);

    fireEvent.focus(section());
    expect(popover()?.getAttribute('role')).toBe('tooltip');
    expect(section().getAttribute('aria-describedby')).toBe(popover()?.id);

    fireEvent.blur(section());
    expect(popover()).toBeNull();
    expect(section().hasAttribute('aria-describedby')).toBe(false);
  });

  it('stays open while focused after the pointer leaves, so a long list can be scrolled', () => {
    render(<FileProblems group={GROUP} />);

    fireEvent.mouseEnter(section());
    fireEvent.focus(section());
    fireEvent.mouseLeave(section());
    expect(popover()).not.toBeNull();

    fireEvent.blur(section());
    expect(popover()).toBeNull();
  });

  it('takes the focus on a click, which holds the popover open', () => {
    render(<FileProblems group={GROUP} />);

    fireEvent.click(section());
    expect(document.activeElement).toBe(section());
    expect(popover()).not.toBeNull();
  });

  it('closes on Escape, whether hovered or focused, and ignores every other key', () => {
    render(<FileProblems group={GROUP} />);
    fireEvent.mouseEnter(section());
    fireEvent.focus(section());

    fireEvent.keyDown(section(), { key: 'Enter' });
    expect(popover()).not.toBeNull();

    fireEvent.keyDown(section(), { key: 'Escape' });
    expect(popover()).toBeNull();
  });

  it('shows a single finding with a count of one', () => {
    render(<FileProblems group={{ severity: 'error', messages: ['only'] }} />);

    expect(section().textContent).toBe('File-level1');
    expect(section().querySelector('[aria-hidden="true"]')?.className).toMatch(/error/i);
  });
});

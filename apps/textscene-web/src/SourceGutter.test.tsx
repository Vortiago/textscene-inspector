/**
 * The gutter's popover wiring: the row holds the hover, so the pointer can reach the list, and
 * the placement measured on opening reaches the popover. happy-dom has no layout, so the tests
 * that need one hand the component its rects through a `getBoundingClientRect` stub.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SourceGutter } from './SourceGutter';
import type { DiagnosticGroup } from './lineDiagnostics';

const ROW = 18;
const VIEWPORT = 400;

const BY_LINE = new Map<number, DiagnosticGroup>([
  [2, { severity: 'warning', messages: ['near the top'] }],
  [21, { severity: 'error', messages: ['near the bottom', 'and another'] }],
]);

function renderGutter() {
  render(<SourceGutter lineCount={22} byLine={BY_LINE} scrollTop={0} />);
}

/** Lays the gutter out as a browser would: `VIEWPORT` tall, one `ROW` per line from its top. */
function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    const testId = this.dataset.testid ?? '';
    const line = /^gutter-row-(\d+)$/.exec(testId)?.[1];
    const top = line === undefined ? 0 : (Number(line) - 1) * ROW;
    const height = testId === 'source-gutter' ? VIEWPORT : ROW;
    return DOMRect.fromRect({ x: 0, y: top, width: 20, height });
  });
}

function popover(line: number) {
  return screen.queryByTestId(`gutter-popover-${line}`);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SourceGutter popover', () => {
  it('stays open while the pointer moves from the dot onto the list', () => {
    renderGutter();
    fireEvent.mouseEnter(screen.getByTestId('gutter-dot-21'));
    const list = popover(21)!;

    fireEvent.mouseOut(screen.getByTestId('gutter-dot-21'), { relatedTarget: list });
    expect(popover(21)).not.toBeNull();
  });

  it('closes when the pointer leaves the row and its list', () => {
    renderGutter();
    fireEvent.mouseEnter(screen.getByTestId('gutter-dot-21'));

    fireEvent.mouseOut(popover(21)!, { relatedTarget: document.body });
    expect(popover(21)).toBeNull();
  });

  it('opens upward from a row in the lower half, capped at the room above it', () => {
    stubLayout();
    renderGutter();
    fireEvent.mouseEnter(screen.getByTestId('gutter-row-21'));

    expect(popover(21)!.parentElement!.className).toMatch(/gutterPopoverUp/);
    expect(popover(21)!.style.maxHeight).toBe(`${21 * ROW - 4}px`);
  });

  it('opens downward from a row in the upper half, capped at the room below it', () => {
    stubLayout();
    renderGutter();
    fireEvent.mouseEnter(screen.getByTestId('gutter-row-2'));

    expect(popover(2)!.parentElement!.className).not.toMatch(/gutterPopoverUp/);
    expect(popover(2)!.style.maxHeight).toBe(`${VIEWPORT - ROW - 4}px`);
  });

  it('keeps the CSS default where there is no layout to measure', () => {
    renderGutter();
    fireEvent.mouseEnter(screen.getByTestId('gutter-row-21'));

    expect(popover(21)!.parentElement!.className).not.toMatch(/gutterPopoverUp/);
    expect(popover(21)!.style.maxHeight).toBe('');
  });

  it('opens on the focus a click gives the dot, and closes on blur', () => {
    renderGutter();
    fireEvent.focus(screen.getByTestId('gutter-dot-2'));
    expect(popover(2)?.textContent).toBe('near the top');

    fireEvent.blur(screen.getByTestId('gutter-dot-2'));
    expect(popover(2)).toBeNull();
  });

  it('gives a row with no diagnostic no dot and no hover target', () => {
    renderGutter();
    expect(screen.queryByTestId('gutter-row-1')).toBeNull();
    expect(screen.queryByTestId('gutter-dot-1')).toBeNull();
  });

  it('keeps a popover closed when a lint drops its finding under the pointer and brings it back', () => {
    const { rerender } = render(<SourceGutter lineCount={22} byLine={BY_LINE} scrollTop={0} />);
    fireEvent.mouseEnter(screen.getByTestId('gutter-row-21'));
    expect(popover(21)).not.toBeNull();

    // The row loses its handlers with its finding, so the pointer leaving it reports nothing.
    rerender(<SourceGutter lineCount={22} byLine={new Map()} scrollTop={0} />);
    rerender(<SourceGutter lineCount={22} byLine={BY_LINE} scrollTop={0} />);
    expect(popover(21)).toBeNull();
  });
});

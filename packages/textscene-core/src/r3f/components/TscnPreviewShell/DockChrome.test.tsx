import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  CollapsedDock,
  isNarrowPane,
  isSheetShare,
  MasterDetailHandle,
  NarrowPaneSwitcher,
  SheetHandle,
} from './DockChrome';
import styles from './TscnPreviewShell.module.css';

/** Gives `el` a layout box, since happy-dom lays nothing out. */
function stubBox(el: Element, top: number, height: number) {
  el.getBoundingClientRect = () =>
    ({ top, height, bottom: top + height, left: 0, right: 100, width: 100, x: 0, y: top }) as DOMRect;
}

/** Drags `handle` to each `clientY` in turn. */
function drag(handle: Element, ...clientYs: number[]) {
  fireEvent.pointerDown(handle, { pointerId: 1, clientY: clientYs[0] });
  for (const clientY of clientYs) fireEvent.pointerMove(handle, { pointerId: 1, clientY });
  fireEvent.pointerUp(handle, { pointerId: 1 });
}

describe('MasterDetailHandle', () => {
  function renderInDock(setValue: (v: number) => void) {
    render(
      <div data-testid="dock">
        <MasterDetailHandle value={0.46} setValue={setValue} />
      </div>
    );
    stubBox(screen.getByTestId('dock'), 100, 400);
    return screen.getByRole('separator');
  }

  it('reports the pointer as a fraction of the dock height', () => {
    const setValue = vi.fn();
    drag(renderInDock(setValue), 300);
    expect(setValue).toHaveBeenLastCalledWith(0.5);
  });

  it('clamps the fraction to 0.2..0.8', () => {
    const setValue = vi.fn();
    const handle = renderInDock(setValue);
    drag(handle, 0);
    expect(setValue).toHaveBeenLastCalledWith(0.2);
    drag(handle, 1000);
    expect(setValue).toHaveBeenLastCalledWith(0.8);
  });

  it('ignores a move without a press', () => {
    const setValue = vi.fn();
    fireEvent.pointerMove(renderInDock(setValue), { pointerId: 1, clientY: 300 });
    expect(setValue).not.toHaveBeenCalled();
  });
});

describe('SheetHandle', () => {
  function renderInColumns(setValue: (v: number) => void, height = 800) {
    render(
      <div data-testid="columns" className={styles.columns}>
        <section>
          <div>
            <SheetHandle value={0.45} setValue={setValue} />
          </div>
        </section>
      </div>
    );
    stubBox(screen.getByTestId('columns'), 44, height);
    return screen.getByRole('separator', { name: 'Resize the scene panel' });
  }

  it('reports the share below the pointer, so a drag upwards grows the sheet', () => {
    const setValue = vi.fn();
    drag(renderInColumns(setValue), 44 + 200);
    expect(setValue).toHaveBeenLastCalledWith(0.75);
  });

  it('clamps the share to 0.25..0.85', () => {
    const setValue = vi.fn();
    const handle = renderInColumns(setValue);
    drag(handle, 0);
    expect(setValue).toHaveBeenLastCalledWith(0.85);
    drag(handle, 2000);
    expect(setValue).toHaveBeenLastCalledWith(0.25);
  });

  it('measures the column once per drag, not once per move', () => {
    const handle = renderInColumns(() => {});
    const columns = screen.getByTestId('columns');
    const measure = vi.spyOn(columns, 'getBoundingClientRect');
    drag(handle, 100, 200, 300);
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('reports nothing while the column has no height', () => {
    const setValue = vi.fn();
    drag(renderInColumns(setValue, 0), 300);
    expect(setValue).not.toHaveBeenCalled();
  });
});

describe('NarrowPaneSwitcher', () => {
  it('marks the shown half as the selected tab', () => {
    render(<NarrowPaneSwitcher pane="details" setPane={() => {}} onCollapse={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Scene' }).getAttribute('aria-selected')).toBe('false');
  });

  it('reports the tapped half', () => {
    const setPane = vi.fn();
    render(<NarrowPaneSwitcher pane="tree" setPane={setPane} onCollapse={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Details' }));
    expect(setPane).toHaveBeenCalledWith('details');
  });

  it('collapses through its own button', () => {
    const onCollapse = vi.fn();
    render(<NarrowPaneSwitcher pane="tree" setPane={() => {}} onCollapse={onCollapse} />);
    fireEvent.click(screen.getByLabelText('Collapse the scene panel'));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });
});

describe('CollapsedDock', () => {
  it('carries both chevrons, so the stylesheet can show the one for the layout', () => {
    render(<CollapsedDock onExpand={() => {}} />);
    const button = screen.getByLabelText('Show the side panel');
    expect(button.textContent).toContain('‹');
    expect(button.textContent).toContain('▴');
  });
});

describe('isSheetShare', () => {
  it('accepts a share the grabber can set, bounds included', () => {
    expect(isSheetShare(0.25)).toBe(true);
    expect(isSheetShare(0.45)).toBe(true);
    expect(isSheetShare(0.85)).toBe(true);
  });

  it('rejects a share outside the grabber range, NaN and a non-number', () => {
    expect(isSheetShare(5)).toBe(false);
    expect(isSheetShare(0.1)).toBe(false);
    expect(isSheetShare(Number.NaN)).toBe(false);
    expect(isSheetShare('0.5')).toBe(false);
  });
});

describe('isNarrowPane', () => {
  it('accepts the two halves and rejects anything else', () => {
    expect(isNarrowPane('tree')).toBe(true);
    expect(isNarrowPane('details')).toBe(true);
    expect(isNarrowPane('inspector')).toBe(false);
    expect(isNarrowPane(null)).toBe(false);
  });
});

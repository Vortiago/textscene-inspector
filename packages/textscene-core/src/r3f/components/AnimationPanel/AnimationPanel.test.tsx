/**
 * AnimationPanel tests (G) — the Animation dock tab. Behavior is exercised
 * through the rendered controls, reading state back from the shared transport.
 */

import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { AnimationPanel, formatTimecode } from './AnimationPanel';
import {
  AnimationTransportProvider,
  useAnimationTransport,
  type PlayerRegistration,
} from '../../contexts/AnimationTransportContext';

const REG: PlayerRegistration = {
  clips: ['idle', 'walk'],
  durations: { idle: 1.0, walk: 0.8 },
  autoplay: 'idle',
};

function Register({ reg }: { reg: PlayerRegistration }) {
  const { registerPlayer } = useAnimationTransport();
  useEffect(() => registerPlayer(reg), [registerPlayer, reg]);
  return null;
}

function renderPanel(reg: PlayerRegistration | null = REG) {
  return render(
    <AnimationTransportProvider>
      {reg && <Register reg={reg} />}
      <AnimationPanel />
    </AnimationTransportProvider>
  );
}

describe('formatTimecode', () => {
  it('formats seconds as m:ss.cc', () => {
    expect(formatTimecode(0.25)).toBe('0:00.25');
    expect(formatTimecode(1.5)).toBe('0:01.50');
    expect(formatTimecode(75)).toBe('1:15.00');
  });
});

describe('AnimationPanel — empty state', () => {
  it('shows an empty message when no clips are registered', () => {
    renderPanel(null);
    expect(screen.getByText(/no animations/i)).toBeDefined();
  });
});

describe('AnimationPanel — clip selector (G2)', () => {
  it('renders an option per clip and reflects the selected clip', () => {
    renderPanel();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['idle', 'walk']);
    expect(select.value).toBe('idle');
  });

  it('changing the selector selects that clip', () => {
    renderPanel();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    act(() => {
      fireEvent.change(select, { target: { value: 'walk' } });
    });
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('walk');
  });
});

describe('AnimationPanel — autoplay marker (E)', () => {
  it('marks the autoplay clip in the selector and leaves others unmarked', () => {
    renderPanel(); // REG: clips [idle, walk], autoplay 'idle'
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const idle = Array.from(select.options).find((o) => o.value === 'idle');
    const walk = Array.from(select.options).find((o) => o.value === 'walk');
    expect(idle?.textContent).toContain('★');
    expect(walk?.textContent).not.toContain('★');
  });

  it('lists RESET plainly (unmarked) when it is present', () => {
    renderPanel({ clips: ['RESET', 'spin'], durations: { RESET: 0, spin: 1 }, autoplay: 'spin' });
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const reset = Array.from(select.options).find((o) => o.value === 'RESET');
    expect(reset).toBeDefined();
    expect(reset?.textContent).not.toContain('★');
  });
});

describe('AnimationPanel — transport buttons (G3)', () => {
  it('toggles between Play and Pause', () => {
    renderPanel();
    act(() => fireEvent.click(screen.getByRole('button', { name: /play/i })));
    expect(screen.getByRole('button', { name: /pause/i })).toBeDefined();
    act(() => fireEvent.click(screen.getByRole('button', { name: /pause/i })));
    expect(screen.getByRole('button', { name: /play/i })).toBeDefined();
  });

  it('stop returns the playhead to zero', () => {
    renderPanel();
    const slider = screen.getByRole('slider') as HTMLInputElement;
    act(() => fireEvent.change(slider, { target: { value: '0.5' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: /stop/i })));
    expect(screen.getByTestId('timecode').textContent).toContain('0:00.00');
  });
});

describe('AnimationPanel — scrubber (G4)', () => {
  it('bounds the scrubber to the selected clip duration and seeks on change', () => {
    renderPanel();
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.max).toBe('1'); // idle duration
    act(() => fireEvent.change(slider, { target: { value: '0.5' } }));
    expect(screen.getByTestId('timecode').textContent).toContain('0:00.50');
  });
});

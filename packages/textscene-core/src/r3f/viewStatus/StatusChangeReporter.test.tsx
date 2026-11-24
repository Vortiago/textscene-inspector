import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusChangeReporter } from './StatusChangeReporter';
import { ViewStatusProvider } from './ViewStatusContext';
import { createViewStatusStore } from './viewStatus';

function reported() {
  const store = createViewStatusStore();
  const onStatusChange = vi.fn();
  render(
    <ViewStatusProvider store={store}>
      <StatusChangeReporter onStatusChange={onStatusChange} />
    </ViewStatusProvider>
  );
  onStatusChange.mockClear();
  return { store, onStatusChange };
}

describe('<StatusChangeReporter>', () => {
  it('tells of the 3D canvas’s freelook turning on, as Shift+F does', () => {
    const { store, onStatusChange } = reported();

    act(() => store.freelookChanged({ isToggled: true, isAvailable: true }));

    expect(onStatusChange).toHaveBeenCalledWith(
      expect.objectContaining({ freelook: { isToggled: true, isAvailable: true } })
    );
  });

  it('stays quiet for a report of the freelook it last told of', () => {
    const { store, onStatusChange } = reported();
    act(() => store.freelookChanged({ isToggled: false, isAvailable: true }));
    onStatusChange.mockClear();

    act(() => store.freelookChanged({ isToggled: false, isAvailable: true }));

    expect(onStatusChange).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { FreelookProvider, useFreelookState } from './FreelookContext';
import { RegisteredFreelook } from './FreelookContext.testkit';
import { Freelook, type FreelookControl } from './freelook';

/** A canvas's freelook whose toggle the browser always grants. */
function grantedFreelook(freelook = new Freelook()): FreelookControl {
  return {
    toggle: () => freelook.setToggled(!freelook.isToggled),
    getState: freelook.getState,
    subscribe: freelook.subscribe,
  };
}

/** A probe of the state the speed readout reads, and the state it last read. */
function freelookProbe() {
  let seen: ReturnType<typeof useFreelookState> = null;
  function Probe(): null {
    seen = useFreelookState();
    return null;
  }
  return { Probe, state: () => seen };
}

describe('FreelookContext', () => {
  it('drops the registered freelook when the canvas unmounts', () => {
    const control = grantedFreelook();
    const probe = freelookProbe();
    const { rerender } = render(
      <FreelookProvider>
        <probe.Probe />
        <RegisteredFreelook control={control} />
      </FreelookProvider>
    );
    expect(probe.state()).toEqual(control.getState());

    rerender(
      <FreelookProvider>
        <probe.Probe />
      </FreelookProvider>
    );

    expect(probe.state()).toBeNull();
  });

  it('keeps the latest registration when two canvases overlap', () => {
    const first = grantedFreelook();
    const second = grantedFreelook();
    const probe = freelookProbe();

    render(
      <FreelookProvider>
        <probe.Probe />
        <RegisteredFreelook control={first} />
        <RegisteredFreelook control={second} />
      </FreelookProvider>
    );
    act(() => second.toggle());

    expect(probe.state()?.isToggled).toBe(true);
  });

  it('reads no state without a provider', () => {
    const probe = freelookProbe();
    render(<probe.Probe />);
    expect(probe.state()).toBeNull();
  });
});

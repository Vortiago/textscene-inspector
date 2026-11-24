import { useEffect } from 'react';
import { useRegisterFreelook } from './FreelookContext';
import { Freelook, type FreelookControl } from './freelook';

/** A canvas's freelook whose toggle the browser always grants. */
export function grantedFreelook(freelook = new Freelook()): FreelookControl {
  return {
    toggle: () => freelook.setToggled(!freelook.isToggled),
    getState: freelook.getState,
    subscribe: freelook.subscribe,
  };
}

/** Stands in for the 3D canvas, which registers its freelook on mount. */
export function RegisteredFreelook({ control }: { control: FreelookControl }): null {
  const register = useRegisterFreelook();
  useEffect(() => register?.(control), [register, control]);
  return null;
}

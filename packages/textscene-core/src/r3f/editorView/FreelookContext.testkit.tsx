import { useEffect } from 'react';
import { useRegisterFreelook } from './FreelookContext';
import type { FreelookControl } from './freelook';

/** Stands in for the 3D canvas, which registers its freelook on mount. */
export function RegisteredFreelook({ control }: { control: FreelookControl }): null {
  const register = useRegisterFreelook();
  useEffect(() => register?.(control), [register, control]);
  return null;
}

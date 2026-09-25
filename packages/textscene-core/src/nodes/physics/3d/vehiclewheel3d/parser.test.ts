import { describe, expect, it } from 'vitest';
import { parseVehicleWheel3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

const wheel = heading('VehicleWheel3D', { name: 'Wheel1' });

describe('parseVehicleWheel3D', () => {
  it('reads the full property surface car_base.tscn authors on a front wheel', () => {
    const props = parseVehicleWheel3D(wheel, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.573678, 0.115169, 1.10416)',
      use_as_traction: 'true',
      use_as_steering: 'true',
      wheel_roll_influence: '0.4',
      wheel_radius: '0.25',
      wheel_friction_slip: '1.0',
      suspension_travel: '2.0',
      suspension_stiffness: '40.0',
      damping_compression: '0.88',
    });

    expect(props.transform?.origin).toEqual({ x: 0.573678, y: 0.115169, z: 1.10416 });
    expect(props.use_as_traction).toBe(true);
    expect(props.use_as_steering).toBe(true);
    expect(props.wheel_roll_influence).toBeCloseTo(0.4, 5);
    expect(props.wheel_radius).toBeCloseTo(0.25, 5);
    expect(props.wheel_friction_slip).toBeCloseTo(1.0, 5);
    expect(props.suspension_travel).toBeCloseTo(2.0, 5);
    expect(props.suspension_stiffness).toBeCloseTo(40.0, 5);
    expect(props.damping_compression).toBeCloseTo(0.88, 5);
  });

  it('reads the simulation-driven properties the corpus never authors', () => {
    const props = parseVehicleWheel3D(wheel, {
      wheel_rest_length: '0.3',
      suspension_max_force: '9000.0',
      damping_relaxation: '0.5',
      engine_force: '40.0',
      brake: '25.0',
      steering: '-0.4',
    });

    expect(props.wheel_rest_length).toBeCloseTo(0.3, 5);
    expect(props.suspension_max_force).toBeCloseTo(9000.0, 5);
    expect(props.damping_relaxation).toBeCloseTo(0.5, 5);
    expect(props.engine_force).toBeCloseTo(40.0, 5);
    expect(props.brake).toBeCloseTo(25.0, 5);
    expect(props.steering).toBeCloseTo(-0.4, 5);
  });

  it('leaves unauthored properties undefined rather than substituting Godot defaults', () => {
    // Baking the default in at parse time would make "author wrote 0.2" and
    // "author wrote nothing" indistinguishable downstream.
    const props = parseVehicleWheel3D(wheel, { wheel_radius: '0.18' });

    expect(props.wheel_radius).toBeCloseTo(0.18, 5);
    expect(props.suspension_travel).toBeUndefined();
    expect(props.damping_relaxation).toBeUndefined();
    expect(props.use_as_traction).toBeUndefined();
    expect(props.use_as_steering).toBeUndefined();
  });

  it('survives the scientific notation the trailer wheels carry in their basis', () => {
    const props = parseVehicleWheel3D(wheel, {
      transform:
        'Transform3D(1, 0, 0, 0, 1, -1.49012e-08, 0, 0, 1, 0.573678, -0.402732, -1.53277)',
    });

    expect(props.transform?.basis_y.z).toBeCloseTo(-1.49012e-8, 12);
    expect(props.transform?.origin.y).toBeCloseTo(-0.402732, 5);
  });

  it('tolerates a non-numeric wheel_radius (edge) → undefined, not NaN', () => {
    const props = parseVehicleWheel3D(wheel, { wheel_radius: 'wide' });
    expect(props.wheel_radius).toBeUndefined();
  });
});

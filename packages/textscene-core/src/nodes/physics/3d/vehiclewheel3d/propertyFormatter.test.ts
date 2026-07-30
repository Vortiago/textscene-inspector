import { describe, expect, it } from 'vitest';
import { formatVehicleWheel3DProperties } from './propertyFormatter';
import type { VehicleWheel3DProperties } from './types';

function sectionTitles(props: VehicleWheel3DProperties): string[] {
  return formatVehicleWheel3DProperties(props).map((s) => s.title);
}

function itemsOf(props: VehicleWheel3DProperties, title: string): Record<string, string> {
  const section = formatVehicleWheel3DProperties(props).find((s) => s.title === title);
  if (!section) throw new Error(`no "${title}" section`);
  return Object.fromEntries(section.items.map((i) => [i.label, i.value]));
}

const frontWheel: VehicleWheel3DProperties = {
  name: 'Wheel1',
  wheel_radius: 0.25,
  wheel_friction_slip: 1,
  wheel_roll_influence: 0.4,
  suspension_stiffness: 40,
  suspension_travel: 2,
  damping_compression: 0.88,
  use_as_traction: true,
  use_as_steering: true,
};

describe('formatVehicleWheel3DProperties', () => {
  it('groups the wheel configuration into Wheel, Suspension and Drive sections', () => {
    expect(sectionTitles(frontWheel)).toEqual(['Wheel', 'Suspension', 'Drive']);
  });

  it('reports the authored wheel geometry', () => {
    expect(itemsOf(frontWheel, 'Wheel')).toEqual({
      Radius: '0.25',
      'Rest Length': '0.15',
      'Friction Slip': '1',
      'Roll Influence': '0.4',
    });
  });

  it('reports the authored suspension configuration', () => {
    expect(itemsOf(frontWheel, 'Suspension')).toEqual({
      Stiffness: '40',
      Travel: '2',
      'Max Force': '6000',
      'Damping Compression': '0.88',
      'Damping Relaxation': '0.88',
    });
  });

  it('reports traction and steering roles', () => {
    expect(itemsOf(frontWheel, 'Drive')).toEqual({ Traction: 'true', Steering: 'true' });
  });

  it("substitutes Godot's defaults for an unconfigured wheel", () => {
    // A bare VehicleWheel3D in Godot is a 0.5m wheel with 10.5 friction slip.
    const bare: VehicleWheel3DProperties = { name: 'Wheel' };
    expect(itemsOf(bare, 'Wheel')).toEqual({
      Radius: '0.5',
      'Rest Length': '0.15',
      'Friction Slip': '10.5',
      'Roll Influence': '0.1',
    });
    expect(itemsOf(bare, 'Suspension').Stiffness).toBe('5.88');
    expect(itemsOf(bare, 'Drive')).toEqual({ Traction: 'false', Steering: 'false' });
  });

  it('appends the inherited Node3D transform sections', () => {
    const placed: VehicleWheel3DProperties = {
      name: 'Wheel1',
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 0.573678, y: 0.115169, z: 1.10416 },
      },
    };
    const sections = formatVehicleWheel3DProperties(placed);
    expect(sections.map((s) => s.title)).toContain('Position');
    const position = sections.find((s) => s.title === 'Position')!;
    expect(position.items.map((i) => i.value)).toEqual(['0.574', '0.115', '1.104']);
  });

  it('omits the runtime drive inputs unless authored (edge)', () => {
    // engine_force / brake / steering are set from GDScript at runtime and are
    // never authored in the corpus; a static preview should not imply otherwise.
    expect(itemsOf(frontWheel, 'Drive')['Engine Force']).toBeUndefined();

    const driven: VehicleWheel3DProperties = { ...frontWheel, engine_force: 40, brake: 25 };
    expect(itemsOf(driven, 'Drive')['Engine Force']).toBe('40');
    expect(itemsOf(driven, 'Drive').Brake).toBe('25');
  });
});

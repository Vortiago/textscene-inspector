import { describe, expect, it } from 'vitest';
import { formatVehicleWheel3DProperties } from './propertyFormatter';
import { sectionsOf, sectionTitled } from '../../../testing/inspectedScene';

const FRONT_WHEEL = {
  wheel_radius: '0.25',
  wheel_friction_slip: '1',
  wheel_roll_influence: '0.4',
  suspension_stiffness: '40',
  suspension_travel: '2',
  damping_compression: '0.88',
  use_as_traction: 'true',
  use_as_steering: 'true',
};

async function itemsOf(properties: Record<string, string>, title: string): Promise<Record<string, string>> {
  const section = sectionTitled(
    await sectionsOf(formatVehicleWheel3DProperties, 'VehicleWheel3D', properties),
    title
  );
  if (!section) throw new Error(`expected a "${title}" section, found none`);
  return Object.fromEntries(section.items.map((i) => [i.label, i.value]));
}

describe('formatVehicleWheel3DProperties', () => {
  it('groups the wheel into Wheel, Suspension and Drive sections', async () => {
    const sections = await sectionsOf(formatVehicleWheel3DProperties, 'VehicleWheel3D', FRONT_WHEEL);
    expect(sections.map((s) => s.title)).toEqual(['Wheel', 'Suspension', 'Drive']);
  });

  it('lists the wheel geometry the file sets', async () => {
    expect(await itemsOf(FRONT_WHEEL, 'Wheel')).toEqual({
      Radius: '0.25',
      'Rest Length': '0.15',
      'Friction Slip': '1',
      'Roll Influence': '0.4',
    });
  });

  it('lists the suspension the file sets', async () => {
    expect(await itemsOf(FRONT_WHEEL, 'Suspension')).toEqual({
      Stiffness: '40',
      Travel: '2',
      'Max Force': '6000',
      'Damping Compression': '0.88',
      'Damping Relaxation': '0.88',
    });
  });

  it('lists the traction and steering roles', async () => {
    expect(await itemsOf(FRONT_WHEEL, 'Drive')).toEqual({ Traction: 'true', Steering: 'true' });
  });

  it("lists Godot's defaults of a wheel that sets nothing", async () => {
    expect(await itemsOf({}, 'Wheel')).toEqual({
      Radius: '0.5',
      'Rest Length': '0.15',
      'Friction Slip': '10.5',
      'Roll Influence': '0.1',
    });
    expect((await itemsOf({}, 'Suspension')).Stiffness).toBe('5.88');
    expect(await itemsOf({}, 'Drive')).toEqual({ Traction: 'false', Steering: 'false' });
  });

  it('appends the Node3D transform sections', async () => {
    const position = await itemsOf(
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.573678, 0.115169, 1.10416)' },
      'Position'
    );
    expect(Object.values(position)).toEqual(['0.574', '0.115', '1.104']);
  });

  it('lists the drive forces a script sets only where the file sets them', async () => {
    expect((await itemsOf(FRONT_WHEEL, 'Drive'))['Engine Force']).toBeUndefined();

    const driven = await itemsOf({ ...FRONT_WHEEL, engine_force: '40', brake: '25' }, 'Drive');
    expect(driven['Engine Force']).toBe('40');
    expect(driven.Brake).toBe('25');
  });
});

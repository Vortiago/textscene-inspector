import { describe, expect, it } from 'vitest';
import { dampedSpringMarker, grooveMarker, pinMarker } from './jointStrokes';

const line = (fx: number, fy: number, tx: number, ty: number) => ({
  from: { x: fx, y: fy },
  to: { x: tx, y: ty },
});

describe('2D joint markers', () => {
  // pin_joint_2d.cpp:45-46
  it('PinJoint2D draws two 20 px lines crossing at the origin', () => {
    expect(pinMarker()).toEqual({ frame: [line(-10, 0, 10, 0), line(0, -10, 0, 10)], offset: [] });
  });

  // groove_joint_2d.cpp:46-49
  it('GrooveJoint2D draws a bar at 0 and at length, the line between, and the offset bar', () => {
    expect(grooveMarker(60, 20)).toEqual({
      frame: [line(-10, 0, 10, 0), line(-10, 60, 10, 60), line(0, 0, 0, 60)],
      offset: [line(-10, 20, 10, 20)],
    });
  });

  it('GrooveJoint2D draws a negative length and offset where they say, not clamped', () => {
    const { frame, offset } = grooveMarker(-30, -5);
    expect(offset).toEqual([line(-10, -5, 10, -5)]);
    expect(frame).toContainEqual(line(0, 0, 0, -30));
  });

  // damped_spring_joint_2d.cpp:46-48
  it('DampedSpringJoint2D draws a bar at 0 and at length, and the line between', () => {
    expect(dampedSpringMarker(80)).toEqual({
      frame: [line(-10, 0, 10, 0), line(-10, 80, 10, 80), line(0, 0, 0, 80)],
      offset: [],
    });
  });
});

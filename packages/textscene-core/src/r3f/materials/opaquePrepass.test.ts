import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  DRAWN_OPAQUE_PREPASS,
  FADED_OPAQUE_PREPASS,
  NO_OPAQUE_PREPASS,
  opaquePrepassOf,
  opaquePrepassUserData,
} from './opaquePrepass';

describe('opaquePrepassOf', () => {
  it('reads the opaque prepass its userData gives a material', () => {
    const material = new THREE.MeshBasicMaterial({ userData: opaquePrepassUserData(DRAWN_OPAQUE_PREPASS) });
    expect(opaquePrepassOf(material)).toBe(DRAWN_OPAQUE_PREPASS);
  });

  it('reads no opaque prepass from a material nothing marked (error case)', () => {
    expect(opaquePrepassOf(new THREE.MeshBasicMaterial())).toBe(NO_OPAQUE_PREPASS);
  });

  it('keeps a faded surface out of the depth prepass while its depth draws still cut (edge case)', () => {
    const material = new THREE.MeshBasicMaterial({ userData: opaquePrepassUserData(FADED_OPAQUE_PREPASS) });
    expect(opaquePrepassOf(material)).toEqual({ cutsDepth: true, drawsPrepass: false });
  });
});

describe('opaquePrepassUserData', () => {
  it('merges beside other userData without touching it', () => {
    const userData = { other: 1, ...opaquePrepassUserData(DRAWN_OPAQUE_PREPASS) };
    expect(opaquePrepassOf(new THREE.MeshBasicMaterial({ userData }))).toBe(DRAWN_OPAQUE_PREPASS);
    expect(userData.other).toBe(1);
  });

  it('records no prepass as no prepass (edge case)', () => {
    const material = new THREE.MeshBasicMaterial({ userData: opaquePrepassUserData(NO_OPAQUE_PREPASS) });
    expect(opaquePrepassOf(material)).toBe(NO_OPAQUE_PREPASS);
  });
});

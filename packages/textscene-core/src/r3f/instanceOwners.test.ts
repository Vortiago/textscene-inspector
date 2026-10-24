/**
 * Who owns a node of the live tree, in Godot's sense: the root of the scene file that authored it. The
 * Gizmos look follows `EditorNode3DGizmo::is_editable` (`node_3d_editor_gizmos.cpp:43-60`).
 */
import { describe, expect, it } from 'vitest';
import { ROOT_OWNER, instanceOwner, isEditableNode, type InstanceOwner } from './instanceOwners';

function rootOwnerListing(...editablePaths: string[]): InstanceOwner {
  return { ...ROOT_OWNER, editablePaths };
}

describe('instanceOwner', () => {
  it('is not editable when no file lists the instance', () => {
    expect(instanceOwner([ROOT_OWNER], 1, 'Inst', []).isEditable).toBe(false);
  });

  it('is editable when the edited root lists the instance', () => {
    expect(instanceOwner([rootOwnerListing('Inst')], 1, 'Inst', []).isEditable).toBe(true);
  });

  it('is editable when the edited root lists a deep instance by its path from the root', () => {
    const owners = [rootOwnerListing('A/B'), instanceOwner([ROOT_OWNER], 1, 'A', [])];
    expect(instanceOwner(owners, 2, 'A/B', []).isEditable).toBe(true);
  });

  it('is editable when the enclosing scene lists it by its path from that scene', () => {
    const owners = [ROOT_OWNER, instanceOwner([ROOT_OWNER], 1, 'A', ['B'])];
    expect(instanceOwner(owners, 2, 'A/B', []).isEditable).toBe(true);
  });

  it('is not editable when an enclosing scene lists a sibling', () => {
    const owners = [ROOT_OWNER, instanceOwner([ROOT_OWNER], 1, 'A', ['Other'])];
    expect(instanceOwner(owners, 2, 'A/B', []).isEditable).toBe(false);
  });
});

describe('isEditableNode', () => {
  const locked = instanceOwner([ROOT_OWNER], 1, 'Inst', []);

  it('holds for a node the edited root authored', () => {
    expect(isEditableNode([ROOT_OWNER, locked], 0, 'Plain')).toBe(true);
  });

  it('holds for a node the edited root added below an instance', () => {
    expect(isEditableNode([ROOT_OWNER, locked], 0, 'Inst/Extra')).toBe(true);
  });

  it('holds for the root of an instance, which the edited root owns', () => {
    expect(isEditableNode([ROOT_OWNER, locked], 1, 'Inst')).toBe(true);
  });

  it('fails for a node the instanced scene authored', () => {
    expect(isEditableNode([ROOT_OWNER, locked], 1, 'Inst/Child')).toBe(false);
  });

  it('holds for a node the instanced scene authored once the root lists the instance', () => {
    const listed = instanceOwner([rootOwnerListing('Inst')], 1, 'Inst', []);
    expect(isEditableNode([rootOwnerListing('Inst'), listed], 1, 'Inst/Child')).toBe(true);
  });

  it('judges a node of a nested instance by the nested instance alone', () => {
    const outer = instanceOwner([rootOwnerListing('A')], 1, 'A', []);
    const inner = instanceOwner([rootOwnerListing('A'), outer], 2, 'A/B', []);
    expect(isEditableNode([rootOwnerListing('A'), outer, inner], 2, 'A/B/Leaf')).toBe(false);
    expect(isEditableNode([rootOwnerListing('A'), outer, inner], 1, 'A/Sibling')).toBe(true);
  });

  it('takes the innermost owner of a level, for an instance the root grafted below another', () => {
    const first = instanceOwner([ROOT_OWNER], 1, 'A', ['X']);
    const grafted = instanceOwner([ROOT_OWNER, first], 1, 'A/Grafted', []);
    expect(isEditableNode([ROOT_OWNER, first, grafted], 1, 'A/Grafted/Leaf')).toBe(false);
  });

  it('holds when no owner of the level is known', () => {
    expect(isEditableNode([ROOT_OWNER], 2, 'A/B/Leaf')).toBe(true);
  });
});

/**
 * Tests for Skeleton3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Skeleton3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Skeleton3D properties', () => {
      // animate_physical_bones = true draws a deprecation warning, not an error.
      expectNoErrors(
        scene(
          node('Skeleton3D', {
            motion_scale: '1.0',
            show_rest_only: false,
            animate_physical_bones: true,
            modifier_callback_mode_process: 1,
          })
        )
      );
    });

    describe('motion_scale validation', () => {
      it('should accept valid positive motion_scale', () => {
        expectClean(scene(node('Skeleton3D', { motion_scale: '1.5' })));
      });

      it('should reject motion_scale of 0', () => {
        expectDiagnostic(scene(node('Skeleton3D', { motion_scale: 0 })), {
          ruleName: 'strict-parser',
          contains: ['motion_scale', 'greater than 0'],
        });
      });

      it('should reject negative motion_scale', () => {
        expectDiagnostic(scene(node('Skeleton3D', { motion_scale: '-1.0' })), {
          ruleName: 'strict-parser',
          contains: ['motion_scale'],
        });
      });

      // skeleton_3d.cpp:586 substitutes 1 for anything `<= 0`, while the hint
      // (:1293, "0.001,10,0.001,or_greater") floors at 0.001, so (0, 0.001) is
      // a band Godot keeps as authored and the inspector excludes.
      it('warns between the substituted floor and the hinted one', () => {
        expectDiagnostic(scene(node('Skeleton3D', { motion_scale: '0.0005' })), {
          ruleName: 'strict-parser',
          severity: 'warning',
          contains: ['motion_scale', '0.001'],
        });
        expectClean(scene(node('Skeleton3D', { motion_scale: '0.001' })));
      });

      it('should reject invalid motion_scale format', () => {
        expectDiagnostic(scene(node('Skeleton3D', { motion_scale: 'not_a_number' })), {
          prop: 'motion_scale',
          contains: ['must be a number'],
        });
      });

      it('should accept very small positive motion_scale', () => {
        // Should pass format validation (> 0)
        expectNoErrors(scene(node('Skeleton3D', { motion_scale: '0.001' })), {
          ruleName: 'strict-parser',
        });
      });

      it('should accept large motion_scale', () => {
        // Should pass format validation (> 0)
        expectNoErrors(scene(node('Skeleton3D', { motion_scale: '100.0' })), {
          ruleName: 'strict-parser',
        });
      });
    });

    runPropertyValidation({ nodeType: 'Skeleton3D', acceptMode: 'no-error' }, [
      {
        prop: 'show_rest_only',
        valid: [true, false],
        // `1` also flips the semantic debug-mode rule on, so the format claim
        // has to name itself or the two are interchangeable here.
        invalid: [
          { value: 'yes', contains: ['true or false'] },
          { value: 1, ruleName: 'strict-parser', contains: ['this slot converts'] },
        ],
      },
      {
        prop: 'animate_physical_bones',
        valid: [true, false],
        invalid: [{ value: 'True', contains: ['true or false'] }],
      },
      {
        prop: 'modifier_callback_mode_process',
        valid: [0, 1, 2],
        invalid: [
          { value: 5, contains: ['0-2', 'PHYSICS', 'IDLE', 'MANUAL'] },
          { value: -1 },
          { value: 'IDLE', contains: ['must be a number'] },
        ],
      },
    ]);

    describe('bone properties validation', () => {
      it('should accept valid bone position (Vector3)', () => {
        expectNoErrors(scene(node('Skeleton3D', { 'bones/0/position': 'Vector3(0, 1.5, 0)' })), {
          ruleName: 'strict-parser',
        });
      });

      it('should accept valid bone rotation (Quaternion)', () => {
        expectNoErrors(
          scene(node('Skeleton3D', { 'bones/1/rotation': 'Quaternion(0, 0.707, 0, 0.707)' })),
          { ruleName: 'strict-parser' }
        );
      });

      it('should accept valid bone scale (Vector3)', () => {
        expectNoErrors(scene(node('Skeleton3D', { 'bones/2/scale': 'Vector3(1, 1, 1)' })), {
          ruleName: 'strict-parser',
        });
      });

      it('should reject invalid bone position format', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/position': 'invalid_format' })), {
          prop: 'bones/0/position',
          contains: ['Vector3'],
        });
      });

      it('should reject invalid bone rotation format', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/rotation': 'Vector3(0, 0, 0)' })), {
          prop: 'bones/0/rotation',
          contains: ['Quaternion'],
        });
      });

      // skeleton_3d.cpp:82 reads the index with a bare
      // `path.get_slicec('/', 1).to_int()` and no validity gate, and `to_int`
      // SKIPS a character it cannot use (ustring.cpp:2280-2293), so `x` names
      // bone 0 and Godot applies the write.
      it('should accept a bone index to_int resolves out of non-numeric text', () => {
        expectNoErrors(scene(node('Skeleton3D', { 'bones/x/position': 'Vector3(0, 0, 0)' })), {
          ruleName: 'strict-parser',
        });
      });

      // `uint32_t which` (:82) holds -1 as 4294967295, which
      // `ERR_FAIL_UNSIGNED_INDEX_V(which, bones.size(), false)` (:90) then
      // refuses: bones grows one at a time through `which == bones.size()` (:85),
      // so no file reaches a count that would admit it.
      it('should reject a negative bone index', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/-1/position': 'Vector3(0, 0, 0)' })), {
          prop: 'Bone index',
          contains: ['4294967295'],
        });
      });

      // `to_int` flips the sign on a `-` seen while the total is still 0
      // (ustring.cpp:2291-2292), so `a-1` is -1 — the same refusal, and a
      // `-\d+` spelling never saw it.
      it('should reject a bone index to_int resolves negative', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/a-1/position': 'Vector3(0, 0, 0)' })), {
          prop: 'Bone index',
          contains: ['4294967295'],
        });
      });

      // `_set` dispatches `what = path.get_slicec('/', 2)` through a whitelist
      // and closes with `} else { return false; }` (skeleton_3d.cpp:135) — the
      // write is dropped, which ADR-0032 grounds at the error tier.
      it('rejects a bone leaf the _set chain has no arm for', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/nonsense': '5' })), {
          prop: 'bones/0/nonsense',
          severity: 'error',
          contains: ['nonsense'],
        });
      });

      // `bones/<i>/name` reaches `add_bone` (skeleton_3d.cpp:86), which opens
      // `ERR_FAIL_COND_V_MSG(p_name.is_empty() || p_name.contains_char(':') ||
      // p_name.contains_char('/'), -1, ...)` (:605) — the bone is never added.
      describe('bone name refusals (skeleton_3d.cpp:605)', () => {
        it('rejects an empty bone name', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/name': '""' })), {
            prop: 'bones/0/name',
            severity: 'error',
            contains: ['non-empty'],
          });
        });

        it('rejects a bone name carrying a colon', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/name': '"spine:1"' })), {
            prop: 'bones/0/name',
            severity: 'error',
            contains: ['carries ":"'],
          });
        });

        it('rejects a bone name carrying a slash', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/name': '"arm/left"' })), {
            prop: 'bones/0/name',
            severity: 'error',
            contains: ['carries "/"'],
          });
        });
      });

      // `bone_meta` is the whole arm name (skeleton_3d.cpp:104); a leaf that
      // merely starts with it is a different `what` and reaches :135.
      it('rejects a leaf that only looks like the bone_meta arm', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/bone_metadata': '"spine"' })), {
          prop: 'bones/0/bone_metadata',
          severity: 'error',
          contains: ['bone_metadata'],
        });
      });

      // skeleton_3d.cpp:721: `ERR_FAIL_COND(p_parent != -1 && (p_parent < 0))`
      // — the setter REFUSES anything below -1. The hint on :196 states the
      // same -1 floor, so it adds no second tier. The ceiling there is
      // `bones.size() - 1`, sibling state no per-property validator can see.
      describe('bone parent (skeleton_3d.cpp:721, :722)', () => {
        it('accepts the -1 root sentinel and a real parent index', () => {
          expectNoErrors(
            scene(
              node('Skeleton3D', { 'bones/0/parent': '-1', 'bones/1/parent': '0' })
            ),
            { ruleName: 'strict-parser' }
          );
        });

        it('rejects a parent below the -1 sentinel', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/parent': '-2' })), {
            prop: 'parent',
            severity: 'error',
            // The BOUND, not the format branch: `-2` parses perfectly well.
            contains: ['must be >= -1'],
          });
        });

        it('rejects a bone parented to itself', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/2/parent': '2' })), {
            prop: 'own parent',
            severity: 'error',
            contains: ['Bone 2 cannot be its own parent'],
          });
        });

        // The index is `to_int` of the whole segment, so `03` is bone 3 and the
        // comparison has to be numeric rather than textual.
        it('rejects a self-parent the index spelling hides', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/03/parent': '3' })), {
            prop: 'own parent',
            severity: 'error',
            contains: ['Bone 3 cannot be its own parent'],
          });
        });

        it('rejects a non-integer parent', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/parent': 'Root' })), {
            prop: 'parent',
            severity: 'error',
            contains: ['must be a number'],
          });
        });
      });

      // :197 Variant::TRANSFORM3D and :198 Variant::BOOL. Both setters (:774,
      // :798) guard the bone index and nothing else, so these are format only.
      describe('bone rest and enabled', () => {
        it('rejects a rest that is not a Transform3D', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/rest': 'Vector3(0, 0, 0)' })), {
            prop: 'rest',
            severity: 'error',
            contains: ['Transform3D'],
          });
        });

        it('rejects an enabled that is not a bool', () => {
          expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/enabled': '1' })), {
            prop: 'enabled',
            severity: 'warning',
            contains: ['converts'],
          });
        });
      });

      // Fences, not red-first cases: every one of them passed before the
      // whitelist existed, because the validator accepted every leaf. They
      // exist to hold the whitelist to the arms `_set` actually has.
      describe('leaves the _set chain does have an arm for (fences)', () => {
        // skeleton_3d.cpp:85 (`name`, through add_bone), :92, :94, :96 — no
        // format check is claimed for these, only that the key is recognised.
        it('accepts the leaves written beside the pose components', () => {
          expectNoErrors(
            scene(
              node('Skeleton3D', {
                'bones/0/name': '"Root"',
                'bones/0/parent': '-1',
                'bones/0/rest': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
                'bones/0/enabled': 'true',
              })
            ),
            { ruleName: 'strict-parser' }
          );
        });

        // skeleton_3d.cpp:107, behind `#ifndef DISABLE_DEPRECATED` (:106).
        // A default build leaves that undefined, so the 3.x pose format loads.
        it('accepts the 3.x pose and bound_children arms', () => {
          expectNoErrors(
            scene(
              node('Skeleton3D', {
                'bones/0/pose': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
                'bones/0/bound_children': '[]',
              })
            ),
            { ruleName: 'strict-parser' }
          );
        });

        // The trap a `BONE_LEAVES.has(match[2])` whitelist springs: `_set`
        // dispatches on `path.get_slicec('/', 2)` (skeleton_3d.cpp:83) and
        // reads the meta key from slice 3 separately (:105), so the arm is
        // `bone_meta` and the key below it is never part of the leaf name.
        // `_get_property_list` writes exactly this shape (:204).
        it('accepts a bone_meta key below the leaf', () => {
          expectNoErrors(
            scene(node('Skeleton3D', { 'bones/0/bone_meta/custom_tag': '"spine"' })),
            { ruleName: 'strict-parser' }
          );
        });

        // Slice 3 of `bones/0/bone_meta` is empty, and `set_bone_meta`
        // (skeleton_3d.cpp:686) guards only the bone index — never the key — so
        // the write lands under an empty meta name.
        it('accepts bone_meta with no key below it', () => {
          expectNoErrors(scene(node('Skeleton3D', { 'bones/0/bone_meta': '"spine"' })), {
            ruleName: 'strict-parser',
          });
        });

        // Nothing reads past slice 2 on the other arms, so a trailing segment
        // is ignored rather than refused: `set_bone_pose_position` still gets
        // this Vector3 (skeleton_3d.cpp:99).
        it('accepts a trailing segment the dispatch never reads', () => {
          expectNoErrors(
            scene(node('Skeleton3D', { 'bones/0/position/ignored': 'Vector3(0, 1, 0)' })),
            { ruleName: 'strict-parser' }
          );
        });
      });

      it('should reject invalid bone property key format', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/invalid': 'Vector3(0, 0, 0)' })), {
          prop: 'bone property key format',
        });
      });

      it('should accept multiple bone properties', () => {
        expectNoErrors(
          scene(
            node('Skeleton3D', {
              'bones/0/position': 'Vector3(0, 1.5, 0)',
              'bones/0/rotation': 'Quaternion(0, 0, 0, 1)',
              'bones/0/scale': 'Vector3(1, 1, 1)',
              'bones/1/position': 'Vector3(0, 3.0, 0)',
            })
          ),
          { ruleName: 'strict-parser' }
        );
      });
    });
  });

  describe('Semantic Validation (Usage Context)', () => {
    describe('motion_scale is the validator\u2019s, not this rule\u2019s', () => {
      // Both bounds live on the validator: `set_motion_scale`
      // (skeleton_3d.cpp:586) substitutes 1 at or below 0, and the hint
      // (:1293, "0.001,10,0.001,or_greater") warns above that. A rule arm here
      // repeating the enforced end reported it twice on the same node. The
      // clean cases are in `motion_scale validation` above.
      it('reports the refused value exactly once', () => {
        const diagnostics = lint(scene(node('Skeleton3D', { motion_scale: '-1.0' })));
        const errors = diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toHaveLength(1);
        expect(errors[0]?.message).toContain('greater than 0');
      });
    });

    describe('debug mode detection', () => {
      it('reports when show_rest_only is enabled', () => {
        expectDiagnostic(scene(node('Skeleton3D', { show_rest_only: true })), {
          ruleName: 'skeleton3d-debug-mode',
          severity: 'info',
          contains: ['debugging mode', 'rest pose'],
        });
      });

      it('should not warn when show_rest_only is false', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { show_rest_only: false })), {
          ruleName: 'skeleton3d-debug-mode',
        });
      });
    });

    describe('deprecated feature detection', () => {
      it('should warn about deprecated animate_physical_bones', () => {
        expectDiagnostic(scene(node('Skeleton3D', { animate_physical_bones: true })), {
          ruleName: 'skeleton3d-deprecated-feature',
          severity: 'warning',
          contains: ['deprecated', 'SkeletonModifier3D'],
        });
      });

      it('should not warn when animate_physical_bones is false', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { animate_physical_bones: false })), {
          ruleName: 'skeleton3d-deprecated-feature',
        });
      });
    });

    // skeleton_3d.cpp:108-110 fires WARN_DEPRECATED_MSG on both 3.x arms
    // before recomputing the pose. The engine warns, so the linter warns.
    describe('3.x bone pose format', () => {
      it('warns about a bones/<i>/pose key', () => {
        expectDiagnostic(
          scene(
            node('Skeleton3D', {
              'bones/0/name': '"Root"',
              'bones/0/pose': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
            })
          ),
          {
            ruleName: 'skeleton3d-deprecated-bone-pose',
            severity: 'warning',
            contains: ['deprecated', 're-save'],
          }
        );
      });

      it('warns about a bones/<i>/bound_children key', () => {
        expectDiagnostic(
          scene(node('Skeleton3D', { 'bones/0/name': '"Root"', 'bones/0/bound_children': '[]' })),
          { ruleName: 'skeleton3d-deprecated-bone-pose', severity: 'warning' }
        );
      });

      it('says nothing about the 4.x pose components', () => {
        expectNoDiagnostic(
          scene(
            node('Skeleton3D', {
              'bones/0/name': '"Root"',
              'bones/0/position': 'Vector3(0, 0, 0)',
            })
          ),
          { ruleName: 'skeleton3d-deprecated-bone-pose' }
        );
      });
    });

    // `bones/<i>/name` reaches add_bone only while `which == bones.size()`
    // (skeleton_3d.cpp:85), and `name` has no arm below the index guard at :90,
    // so a name naming any other slot is a dropped write.
    describe('bone name ordering', () => {
      it('leaves a sequentially named skeleton clean', () => {
        expectNoDiagnostic(
          scene(node('Skeleton3D', { 'bones/0/name': '"Root"', 'bones/1/name': '"Head"' })),
          { ruleName: 'skeleton3d-bone-name-order' }
        );
      });

      it('reports a name that skips a bone slot', () => {
        expectDiagnostic(
          scene(node('Skeleton3D', { 'bones/0/name': '"Root"', 'bones/2/name': '"Head"' })),
          {
            ruleName: 'skeleton3d-bone-name-order',
            severity: 'error',
            contains: ['bones/2/name'],
          }
        );
      });

      it('reports a skeleton whose first bone is not bone 0', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/1/name': '"Root"' })), {
          ruleName: 'skeleton3d-bone-name-order',
          severity: 'error',
          contains: ['bones/1/name'],
        });
      });

      // add_bone refuses a name already taken (skeleton_3d.cpp:606), so that
      // bone is never added and every later slot shifts — the count has to
      // model it or the next name reports a refusal that never happened.
      it('reports a duplicate bone name', () => {
        expectDiagnostic(
          scene(node('Skeleton3D', { 'bones/0/name': '"Root"', 'bones/1/name': '"Root"' })),
          {
            ruleName: 'skeleton3d-duplicate-bone-name',
            severity: 'error',
            contains: ['bones/1/name', 'Root'],
          }
        );
      });

      // Phase 1 already reports the :605 refusal on this key; the ordering rule
      // must not report it a second time, only account for the missing bone.
      it('reports the name refused by add_bone exactly once', () => {
        const diagnostics = lint(
          scene(node('Skeleton3D', { 'bones/0/name': '""', 'bones/1/name': '"Head"' }))
        );
        const onBone0 = diagnostics.filter((d) => d.message.includes('bones/0/name'));
        expect(onBone0).toHaveLength(1);
        expect(onBone0[0]?.message).toContain('non-empty');
      });

      // A negative index is phase 1's INVALID_BONE_INDEX; the rule leaves it be
      // rather than reporting the same key under a second name.
      it('leaves a negative bone index to the validator', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { 'bones/-1/name': '"Root"' })), {
          ruleName: 'skeleton3d-bone-name-order',
        });
      });
    });

    // No rule reads the mode, so each legal value must leave the scene wholly
    // clean; filtering the absence by one rule name would pass whatever fired.
    describe('modifier_callback_mode_process (no diagnostic)', () => {
      it('leaves PHYSICS mode clean', () => {
        expectClean(scene(node('Skeleton3D', { modifier_callback_mode_process: 0 })));
      });

      it('leaves MANUAL mode clean', () => {
        expectClean(scene(node('Skeleton3D', { modifier_callback_mode_process: 2 })));
      });

      it('leaves the default IDLE mode clean', () => {
        expectClean(scene(node('Skeleton3D', { modifier_callback_mode_process: 1 })));
      });
    });

    // A Skeleton3D is legitimately consumed by BoneAttachment3D or
    // SkeletonModifier3D subtrees, not only by a MeshInstance3D, and Skeleton3D
    // overrides no get_configuration_warnings.
    describe('skeleton usage validation', () => {
      it('reports nothing when no MeshInstance3D references the skeleton', () => {
        // Every mesh states `parent="."`. Without it the heading is a second
        // ROOT, which the tree build drops — so "no MeshInstance3D references
        // the skeleton" held because there was no MeshInstance3D in the tree.
        expectClean(
          scene(
            node('Node3D', {}, { name: 'Root' }),
            node('Skeleton3D', {}, { name: 'UnusedSkeleton', parent: '.' }),
            node('MeshInstance3D', {}, { name: 'SomeMesh', parent: '.' })
          )
        );
        expectClean(
          scene(
            node('Node3D', {}, { name: 'Root' }),
            node('Skeleton3D', {}, { name: 'UnusedSkeleton', parent: '.' }),
            node('Skeleton3D', {}, { name: 'OtherSkeleton', parent: '.' }),
            node(
              'MeshInstance3D',
              { skeleton: 'NodePath("../OtherSkeleton")' },
              { name: 'Mesh', parent: '.' }
            )
          )
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      expectClean(scene(node('Skeleton3D', {}, { name: 'EmptySkeleton' })));
    });

    it('should handle multiple validation issues', () => {
      const diagnostics = lint(
        scene(
          node('Skeleton3D', {
            show_rest_only: true,
            animate_physical_bones: true,
            modifier_callback_mode_process: 0,
          })
        )
      );
      // Should have multiple warning messages (show_rest_only + animate_physical_bones)
      expect(diagnostics.length).toBeGreaterThanOrEqual(2);
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should handle skeleton with all properties correctly set', () => {
      const diagnostics = lint(
        scene(
          node('Skeleton3D', {
            motion_scale: '1.0',
            show_rest_only: false,
            animate_physical_bones: false,
            modifier_callback_mode_process: 1,
            'bones/0/position': 'Vector3(0, 0, 0)',
            'bones/0/rotation': 'Quaternion(0, 0, 0, 1)',
            'bones/0/scale': 'Vector3(1, 1, 1)',
          }, { name: 'CompleteSkeleton' }),
          node(
            'MeshInstance3D',
            { skeleton: 'NodePath("..")' },
            { name: 'CharacterMesh', parent: '.' }
          )
        )
      );
      // Should have no warnings or errors
      expect(diagnostics.filter(d => d.severity === 'error' || d.severity === 'warning')).toHaveLength(0);
    });

    it('should handle complex bone hierarchy', () => {
      expectNoErrors(
        scene(
          node('Skeleton3D', {
            'bones/0/position': 'Vector3(0, 0, 0)',
            'bones/0/rotation': 'Quaternion(0, 0, 0, 1)',
            'bones/1/position': 'Vector3(0, 1, 0)',
            'bones/1/rotation': 'Quaternion(0, 0.707, 0, 0.707)',
            'bones/2/position': 'Vector3(0, 2, 0)',
            'bones/2/rotation': 'Quaternion(0, 0, 0, 1)',
            'bones/2/scale': 'Vector3(0.5, 0.5, 0.5)',
          }, { name: 'ComplexSkeleton' }),
          node('MeshInstance3D', { skeleton: 'NodePath("..")' }, { name: 'Mesh', parent: '.' })
        ),
        { ruleName: 'strict-parser' }
      );
    });

    // The whole bone block `scenes/fixtures/unit-bone-attachment-3d.tscn`
    // carries, verbatim: the only skeleton in the corpus, and the shape Godot
    // itself writes. Every leaf check added here has to leave it clean.
    it('leaves a Godot-written bone block clean', () => {
      expectClean(
        scene(
          node(
            'Skeleton3D',
            {
              'bones/0/name': '"Root"',
              'bones/0/parent': '-1',
              'bones/0/rest': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
              'bones/0/enabled': 'true',
              'bones/0/position': 'Vector3(0, 0, 0)',
              'bones/0/rotation': 'Quaternion(0, 0, 0, 1)',
              'bones/0/scale': 'Vector3(1, 1, 1)',
              'bones/1/name': '"Head"',
              'bones/1/parent': '0',
              'bones/1/rest': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
              'bones/1/enabled': 'true',
              'bones/1/position': 'Vector3(0, 1, 0)',
              'bones/1/rotation': 'Quaternion(0, 0, 0, 1)',
              'bones/1/scale': 'Vector3(1, 1, 1)',
            },
            { name: 'Skeleton3D' }
          )
        )
      );
    });

    it('should handle scientific notation in bone transforms', () => {
      expectNoErrors(
        scene(
          node('Skeleton3D', {
            'bones/0/position': 'Vector3(1.5e-3, 2.0e+2, -3.14e1)',
            'bones/0/rotation': 'Quaternion(1e-5, 0, 0, 1.0)',
          }, { name: 'ScientificBones' })
        ),
        { ruleName: 'strict-parser' }
      );
    });
  });
});

describe('Skeleton3D Linter — the tokenizer float grammar', () => {
  it('accepts a trailing-dot bone rotation component', () => {
    expectNoErrors(
      scene(node('Skeleton3D', { 'bones/0/rotation': 'Quaternion(0.5, 0, 0, 1.)' })),
      { ruleName: 'strict-parser' }
    );
  });
});

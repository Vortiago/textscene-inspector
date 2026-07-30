---
type: BoneConstraint3D
category: 3D
status: linter-only
fixture: unit-bone-constraint-3d.tscn
# image: unit-bone-constraint-3d
visual: false
renders_as: nothing (a transform-only group)
---

# BoneConstraint3D

This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin BoneConstraint3D -->
Strict parsing format-checks the inherited set (2 inherited from SkeletonModifier3D, 16 inherited from Node3D); `BoneConstraint3D` declares none of its own. Every validator failure is an **error**.

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

BoneConstraint3D registers no validators or semantic rules of its own yet, so the strict
and lenient parsers agree on every property: whatever `parser.ts` reads it reads
without substitution. Replace this once `linterParser.ts` has validators, naming
the property and the value the lenient parser falls back to.

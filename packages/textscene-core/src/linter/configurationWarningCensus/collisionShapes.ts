/**
 * The shape PROVIDERS — `CollisionShape2D`/`3D`, `CollisionPolygon2D`/`3D` — and
 * the shape casts that carry the same "no shape assigned" condition.
 *
 * The bodies these hang under are in `physicsBodies.ts`; the split follows the
 * declaring class, since that is what a row's reach is computed from.
 */
import type { WarningRow } from './types.js';

export const collisionShapeWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  CollisionPolygon2D: [
    {
      at: 'collision_polygon_2d.cpp:236',
      says: 'only serves to give a collision shape to a CollisionObject2D-derived parent',
      verdict: { rule: 'collisionpolygon2d-invalid-parent' },
    },
    {
      at: 'collision_polygon_2d.cpp:236',
      says: 'only serves to give a collision shape to a CollisionObject2D-derived parent',
      verdict: { rule: 'collisionpolygon2d-no-parent' },
    },
    {
      at: 'collision_polygon_2d.cpp:241',
      says: 'an empty polygon has no effect on collision',
      verdict: { rule: 'collisionpolygon2d-empty-polygon' },
    },
    {
      at: 'collision_polygon_2d.cpp:246',
      says: 'invalid polygon: at least 3 points needed in Solids build mode',
      verdict: { rule: 'collisionpolygon2d-insufficient-points' },
    },
    {
      at: 'collision_polygon_2d.cpp:249',
      says: 'invalid polygon: at least 2 points needed in Segments build mode',
      verdict: { rule: 'collisionpolygon2d-insufficient-points' },
    },
    {
      at: 'collision_polygon_2d.cpp:253',
      says: 'One Way Collision is ignored under an Area2D',
      verdict: { rule: 'collisionpolygon2d-one-way-ignored' },
    },
  ],

  CollisionPolygon3D: [
    {
      at: 'collision_polygon_3d.cpp:239',
      says: 'only serves to give a collision shape to a CollisionObject3D-derived parent',
      verdict: { rule: 'collisionpolygon3d-invalid-parent' },
    },
    {
      at: 'collision_polygon_3d.cpp:239',
      says: 'only serves to give a collision shape to a CollisionObject3D-derived parent',
      verdict: { rule: 'collisionpolygon3d-no-parent' },
    },
    {
      at: 'collision_polygon_3d.cpp:243',
      says: 'an empty polygon has no effect on collision',
      verdict: { rule: 'collisionpolygon3d-empty-polygon' },
    },
    {
      at: 'collision_polygon_3d.cpp:248',
      says: 'non-uniform scale will probably not function as expected',
      verdict: { rule: 'collisionpolygon3d-non-uniform-scale' },
    },
  ],

  CollisionShape2D: [
    {
      at: 'collision_shape_2d.cpp:176',
      says: 'only serves to give a collision shape to a CollisionObject2D-derived parent',
      verdict: { rule: 'collisionshape2d-invalid-parent' },
    },
    {
      at: 'collision_shape_2d.cpp:176',
      says: 'only serves to give a collision shape to a CollisionObject2D-derived parent',
      verdict: { rule: 'collisionshape2d-no-parent' },
    },
    {
      at: 'collision_shape_2d.cpp:179',
      says: 'a shape resource must be provided to function',
      verdict: { rule: 'collisionshape2d-requires-shape' },
    },
    {
      at: 'collision_shape_2d.cpp:182',
      says: 'One Way Collision is ignored under an Area2D',
      verdict: { rule: 'collisionshape2d-one-way-ignored-under-area2d' },
    },
    {
      at: 'collision_shape_2d.cpp:188',
      says: 'has limited editing for polygon-based shapes, consider CollisionPolygon2D',
      verdict: { rule: 'collisionshape2d-polygon-shape-limited-editing' },
    },
  ],

  CollisionShape3D: [
    {
      at: 'collision_shape_3d.cpp:127',
      says: 'only serves to give a collision shape to a CollisionObject3D-derived parent',
      verdict: { rule: 'collisionshape3d-invalid-parent' },
    },
    {
      at: 'collision_shape_3d.cpp:127',
      says: 'only serves to give a collision shape to a CollisionObject3D-derived parent',
      verdict: { rule: 'collisionshape3d-no-parent' },
    },
    {
      at: 'collision_shape_3d.cpp:131',
      says: 'a shape resource must be provided to function',
      verdict: { rule: 'collisionshape3d-requires-shape' },
    },
    {
      at: 'collision_shape_3d.cpp:141',
      says: 'ConcavePolygonShape3D will likely not behave well for a RigidBody3D/VehicleBody3D',
      verdict: { rule: 'collisionshape3d-concave-under-rigidbody' },
    },
    {
      at: 'collision_shape_3d.cpp:143',
      says: "WorldBoundaryShape3D doesn't support RigidBody3D in a non-static mode",
      verdict: { rule: 'collisionshape3d-worldboundary-under-rigidbody' },
    },
    {
      at: 'collision_shape_3d.cpp:149',
      says: 'ConcavePolygonShape3D will likely not behave well for a CharacterBody3D',
      verdict: { rule: 'collisionshape3d-concave-under-characterbody' },
    },
    {
      at: 'collision_shape_3d.cpp:155',
      says: 'non-uniform scale will probably not function as expected',
      verdict: { rule: 'collisionshape3d-non-uniform-scale' },
    },
  ],

  ShapeCast2D: [
    {
      at: 'shape_cast_2d.cpp:408',
      says: 'cannot interact with anything without a Shape2D assigned',
      verdict: { rule: 'shapecast2d-missing-shape' },
    },
  ],

  ShapeCast3D: [
    {
      at: 'shape_cast_3d.cpp:186',
      says: 'cannot interact with anything without a Shape3D assigned',
      verdict: { rule: 'shapecast3d-missing-shape' },
    },
    {
      at: 'shape_cast_3d.cpp:189',
      says: 'does not support ConcavePolygonShape3D',
      verdict: { rule: 'shapecast3d-concave-shape' },
    },
  ],
};

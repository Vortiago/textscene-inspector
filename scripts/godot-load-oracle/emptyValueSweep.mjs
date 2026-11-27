import { writeCaseFiles } from './writeCaseFiles.mjs';

/** What follows a `key =` with no value: a key, a heading, or either after a blank line. */
const FOLLOWERS = {
  key: ['other = 1'],
  heading: ['[node name="B" type="Node2D" parent="."]'],
  blank_then_key: ['', 'other = 1'],
  blank_then_heading: ['', '[node name="B" type="Node2D" parent="."]'],
};

/** The body the empty value sits in: a node's, or a sub-resource's. */
const PLACES = {
  node: (follower) => [
    '[node name="Root" type="Node2D"]',
    '',
    '[node name="A" type="Node2D" parent="."]',
    'position = Vector2(5, 5)',
    'key =',
    ...follower,
  ],
  sub_resource: (follower) => [
    '[sub_resource type="Gradient" id="g"]',
    'key =',
    ...follower,
    '',
    '[node name="Root" type="Node2D"]',
    '',
    '[node name="A" type="Node2D" parent="."]',
    'position = Vector2(5, 5)',
  ],
};

const cases = Object.entries(PLACES).flatMap(([place, lines]) =>
  Object.entries(FOLLOWERS).map(([name, follower]) => ({
    file: `${place}__${name}.tscn`,
    text: ['[gd_scene format=3]', '', ...lines(follower), ''].join('\n'),
  }))
);
console.log(writeCaseFiles(process.argv[2], cases));

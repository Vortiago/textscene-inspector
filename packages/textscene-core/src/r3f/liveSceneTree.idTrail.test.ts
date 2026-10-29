/**
 * A heading whose `parent_id_path=` ends inside the content of an instance. Godot maps each id of
 * the trail to the path of its heading in that heading's own scene state, through each middle
 * instance and base scene, and walks the joined path from the file root
 * (packed_scene.cpp:1947-2005). Only the file that holds the instance can follow the rest.
 */
import { describe, expect, it } from 'vitest';
import { livePathsOver } from './liveSceneTree.testkit';
import {
  INNER_ID,
  TRAIL_BASE,
  PLAYER_ID,
  PLAYER_SCENE_ONLY,
  TRAIL_SCENES,
  hostOf,
  inheritingTrailBase,
  parseScene,
  pathsEnding,
  playerHeading,
  playerHost,
} from './idTrail.testkit';
import '../nodes/node/index';
import '../nodes/base/node3d/index';

const capWithTrail = (...ids: number[]) =>
  `[node name="Cap" type="Node3D" parent="Missing" parent_id_path=PackedInt32Array(${ids.join(', ')})]`;

describe('a parent_id_path that ends inside instance content', () => {
  it('seats the heading under the node the trail finds in the instanced scene', () => {
    const paths = livePathsOver(playerHost(capWithTrail(PLAYER_ID, INNER_ID)), TRAIL_SCENES);

    expect(paths).toContain('Main/Player/Inner/Cap');
    expect(paths.filter((path) => path.endsWith('Cap'))).toEqual(['Main/Player/Inner/Cap']);
  });

  it('seats the heading under the instance root where the trail names the root heading', () => {
    const host = playerHost(capWithTrail(PLAYER_ID, 1));

    expect(pathsEnding(host, 'Cap')).toEqual(['Main/Player/Cap']);
  });

  it('re-roots the heading where no heading of the instanced scene carries the id', () => {
    const host = playerHost(capWithTrail(PLAYER_ID, 9999));

    expect(pathsEnding(host, 'Cap')).toEqual(['Main/Missing#Cap']);
  });

  it('re-roots the heading where the first id names no heading of this file', () => {
    const host = playerHost(capWithTrail(9999, INNER_ID));

    expect(pathsEnding(host, 'Cap')).toEqual(['Main/Missing#Cap']);
  });

  it('finds an id that only the base of the instanced scene holds', () => {
    const base = parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://inner.tscn" id="inner"]

[node name="Base" type="Node3D" unique_id=1]

[node name="Inner" parent="." instance=ExtResource("inner") unique_id=${INNER_ID}]
`);
    const derived = parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Player" instance=ExtResource("base") unique_id=1]
`);
    const scenes = { ...TRAIL_SCENES, 'res://base.tscn': base, 'res://player.tscn': derived };

    const host = playerHost(capWithTrail(PLAYER_ID, INNER_ID));

    expect(pathsEnding(host, 'Cap', scenes)).toEqual(['Main/Player/Inner/Cap']);
  });

  it('follows a trail through a second instance into its scene', () => {
    const deep = parseScene(`[gd_scene format=3]

[node name="Inner" type="Node3D" unique_id=1]

[node name="Deep" type="Node3D" parent="." unique_id=4444]
`);

    const paths = livePathsOver(playerHost(capWithTrail(PLAYER_ID, INNER_ID, 4444)), {
      ...TRAIL_SCENES,
      'res://inner.tscn': deep,
    });

    expect(paths.filter((path) => path.endsWith('Cap'))).toEqual(['Main/Player/Inner/Deep/Cap']);
  });

  it('keeps the heading in the instance, not re-rooted, while a scene the trail enters is not loaded', () => {
    const deepTrail = playerHost(capWithTrail(PLAYER_ID, INNER_ID, 4444));

    expect(pathsEnding(deepTrail, 'Cap', PLAYER_SCENE_ONLY)).toEqual(['Main/Player/Cap']);
  });

  it('seats nothing in the instance while its own scene is not loaded', () => {
    const host = playerHost(capWithTrail(PLAYER_ID, INNER_ID));

    expect(pathsEnding(host, 'Cap', {})).toEqual(['Main/Player/Cap']);
  });
});

describe('a heading seated through a parent_id_path that enters an instance, then addressed by %Name', () => {
  const unique = (name: string, parent: string) =>
    `[node name="${name}" type="Node3D" parent="${parent}"]
unique_name_in_owner = true
`;
  const capWithClaim = `${capWithTrail(PLAYER_ID, INNER_ID)}
unique_name_in_owner = true
`;
  const heading = (name: string, parent: string) =>
    `\n[node name="${name}" type="Node3D" parent="${parent}"]\n`;
  it('seats a later heading under the node the %Name names', () => {
    const host = playerHost(capWithClaim + heading('Hat', '%Cap'));

    expect(pathsEnding(host, 'Hat')).toEqual(['Main/Player/Inner/Cap/Hat']);
  });

  it('seats a heading under a node below the claimant, through its own %Name', () => {
    const host = playerHost(capWithClaim + unique('Hat', '%Cap') + heading('Leaf', '%Hat'));

    expect(pathsEnding(host, 'Leaf')).toEqual(['Main/Player/Inner/Cap/Hat/Leaf']);
  });

  it('seats a heading by a path from the claimant, not from the instance', () => {
    const host = playerHost(capWithClaim + heading('Hat', '%Cap') + heading('Leaf', '%Cap/Hat'));

    expect(pathsEnding(host, 'Leaf')).toEqual(['Main/Player/Inner/Cap/Hat/Leaf']);
  });

  it('re-roots a heading that names the node by a path through the instance only, as Godot finds no node there', () => {
    const host = playerHost(capWithClaim + heading('Hat', 'Player/Cap'));

    expect(pathsEnding(host, 'Hat')).toEqual(['Main/Player_Cap#Hat']);
  });

  it('re-roots with its parent where the trail finds nothing, as the renamed node claims another name', () => {
    const lost = capWithClaim.replace(`${PLAYER_ID}, ${INNER_ID}`, `${PLAYER_ID}, 9999`);
    const host = playerHost(lost + heading('Hat', '%Cap'));

    expect(pathsEnding(host, 'Hat')).toEqual(['Main/_Cap#Hat']);
  });
});

describe('a heading below a trail-seated heading, with an explicit owner= of its own', () => {
  const capWithBrim = (brimOwner: string) => `${capWithTrail(PLAYER_ID, INNER_ID)}
unique_name_in_owner = true

[node name="Brim" type="Node3D" parent="%Cap" owner="${brimOwner}"]
unique_name_in_owner = true
`;
  const feather = (parent: string) => `\n[node name="Feather" type="Node3D" parent="${parent}"]\n`;

  it('registers its %Name in the table of the instance its owner= names', () => {
    const host = playerHost(capWithBrim('Player') + feather('Player/%Brim'));

    expect(pathsEnding(host, 'Feather')).toEqual(['Main/Player/Inner/Cap/Brim/Feather']);
  });

  it('registers it in no table of the root', () => {
    const host = playerHost(capWithBrim('Player') + feather('%Brim'));

    expect(pathsEnding(host, 'Feather')).toEqual(['Main/_Brim#Feather']);
  });

  it('registers it in the table of the nested instance its owner= names', () => {
    const host = playerHost(capWithBrim('Player/Inner') + feather('Player/Inner/%Brim'));

    expect(pathsEnding(host, 'Feather')).toEqual(['Main/Player/Inner/Cap/Brim/Feather']);
  });

  it('registers it in the table of another instance its owner= names, from outside that instance', () => {
    const other = `[node name="Other" parent="." instance=ExtResource("player") unique_id=4444]\n\n`;
    const host = playerHost(other + capWithBrim('Other') + feather('Other/%Brim'));

    expect(pathsEnding(host, 'Feather')).toEqual(['Main/Player/Inner/Cap/Brim/Feather']);
  });
});

describe('a heading below a trail-seated heading, in a file whose root inherits a base', () => {
  const BASE_SCENES = { 'res://base.tscn': TRAIL_BASE };
  const quill = (below: string) =>
    pathsEnding(
      inheritingTrailBase(`[node name="Cap" type="Node3D" parent="Nope" parent_id_path=PackedInt32Array(77)]
unique_name_in_owner = true

[node name="${below}" type="Node3D" parent="%Cap"]
unique_name_in_owner = true

[node name="Quill" type="Node3D" parent="%${below}"]
`),
      'Quill',
      BASE_SCENES
    );

  it('leaves a name the base claimed first with the base node', () => {
    expect(quill('Feather')).toEqual(['Main/Feather/Quill']);
  });

  it('claims a free name in the table of the inherited root', () => {
    expect(quill('Brim')).toEqual(['Main/Deep/Cap/Brim/Quill']);
  });

  it('seats a heading below the claimant of this file, for a name the base leaves free', () => {
    const host = inheritingTrailBase(`[node name="Foo" type="Node3D" parent="."]
unique_name_in_owner = true

[node name="Child" type="Node3D" parent="%Foo"]
`);

    expect(pathsEnding(host, 'Child', BASE_SCENES)).toEqual(['Main/Foo/Child']);
  });

  it('leaves a name the base claimed first with the base node, for a heading seated by its parent=', () => {
    const host = inheritingTrailBase(`[node name="Mid" type="Node3D" parent="."]

[node name="Feather" type="Node3D" parent="Mid"]
unique_name_in_owner = true

[node name="Quill" type="Node3D" parent="%Feather"]
`);

    expect(pathsEnding(host, 'Quill', BASE_SCENES)).toEqual(['Main/Feather/Quill']);
  });
});

describe('a heading addressed by %Name below a node that re-roots', () => {
  it('re-roots with it, since the renamed node claims the renamed name', () => {
    const host = playerHost(`[node name="Q" type="Node3D" parent="Player/Gone"]
unique_name_in_owner = true

[node name="Hat" type="Node3D" parent="%Q"]

[node name="Sleeve" type="Node3D" parent="Player/Gone/Q"]
`);

    const paths = livePathsOver(host, TRAIL_SCENES).filter((path) => /Q|Hat|Sleeve/.test(path));

    expect(paths).toEqual(['Main/Player_Gone#Q', 'Main/_Q#Hat', 'Main/Player_Gone_Q#Sleeve']);
  });
});

describe('a heading whose %Name an owner_uid_path that enters an instance registers', () => {
  const lampOwnedBy = (
    owner: string,
    trail: string
  ) => `[node name="Lamp" type="Node3D" parent="." owner="${owner}" owner_uid_path=PackedInt32Array(${trail})]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="Player/Inner/%Lamp"]`;
  const lamp = (trail: string) => lampOwnedBy('Gone', trail);

  it('seats a later heading under the node the table of the owner the trail finds names', () => {
    const host = playerHost(lamp(`${PLAYER_ID}, ${INNER_ID}`));

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Lamp/Shade']);
  });

  it('re-roots the later heading where no heading answers the rest of the trail, so no table holds the name', () => {
    const host = playerHost(lamp(`${PLAYER_ID}, 9999`));

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Player_Inner__Lamp#Shade']);
  });

  describe('where the owner= walk enters the instance and finds nothing', () => {
    it('falls back to the owner its owner_uid_path finds', () => {
      const host = playerHost(lampOwnedBy('Player/Gone', `${PLAYER_ID}, ${INNER_ID}`));

      expect(pathsEnding(host, 'Shade')).toEqual(['Main/Lamp/Shade']);
    });

    it('reads no trail where the walk finds the owner', () => {
      const host = playerHost(lampOwnedBy('Player/Inner', `${PLAYER_ID}, 9999`));

      expect(pathsEnding(host, 'Shade')).toEqual(['Main/Lamp/Shade']);
    });

    it('leaves the node with no owner where the trail finds nothing either', () => {
      const host = playerHost(lampOwnedBy('Player/Gone', `${PLAYER_ID}, 9999`));

      expect(pathsEnding(host, 'Shade')).toEqual(['Main/Player_Inner__Lamp#Shade']);
    });

    it('takes the instance itself as owner where the trail ends on its heading', () => {
      const host = playerHost(lampOwnedBy('Player/Gone', `${PLAYER_ID}`));

      expect(pathsEnding(host, 'Shade')).toEqual(['Main/Lamp/Shade']);
    });
  });
});

describe('an owner= walk that finds nothing in one instance, with an owner_uid_path= owner in another', () => {
  const OTHER_ID = 4444;
  const other = `[node name="Other" parent="." instance=ExtResource("player") unique_id=${OTHER_ID}]\n`;
  const lamp = (
    owner: string,
    shadeParent: string
  ) => `[node name="Lamp" type="Node3D" parent="." owner="${owner}" owner_uid_path=PackedInt32Array(${OTHER_ID}, ${INNER_ID})]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="${shadeParent}"]
`;

  it('registers the %Name in the table of the owner the trail finds in the other instance', () => {
    const host = playerHost(other + lamp('Player/Gone', 'Other/Inner/%Lamp'));

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Lamp/Shade']);
  });

  it('registers it there where the other instance comes first in the tree', () => {
    const host = hostOf(`${other}\n${playerHeading}\n${lamp('Player/Gone', 'Other/Inner/%Lamp')}`);

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Lamp/Shade']);
  });

  it('registers it in no table of the other instance where the first instance holds the walked owner', () => {
    const host = playerHost(other + lamp('Player/Inner', 'Other/Inner/%Lamp'));

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Other_Inner__Lamp#Shade']);
  });

  it('registers it in the table of the first instance where the walk finds the owner there', () => {
    const host = playerHost(other + lamp('Player/Inner', 'Player/Inner/%Lamp'));

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Lamp/Shade']);
  });

  it('hands it to the other instance where the walk finds nothing in a nested instance of the first', () => {
    const host = playerHost(other + lamp('Player/Inner/Gone', 'Other/Inner/%Lamp'));

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Lamp/Shade']);
  });

  it('registers it in no table of the first instance where the walk finds nothing there', () => {
    const host = playerHost(other + lamp('Player/Gone', 'Player/Inner/%Lamp'));

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Player_Inner__Lamp#Shade']);
  });

  describe('where the owner_uid_path= owner is the root, which inherits a base', () => {
    const base = parseScene(`[gd_scene format=3]

[node name="Base" type="Node3D" unique_id=1]
`);
    const inheritingHost = (owner: string) =>
      parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]
[ext_resource type="PackedScene" path="res://player.tscn" id="player"]

[node name="Main" instance=ExtResource("base") unique_id=9]

${playerHeading}
[node name="Lamp" type="Node3D" parent="." owner="${owner}" owner_uid_path=PackedInt32Array(9)]
unique_name_in_owner = true

[node name="Shade" type="Node3D" parent="%Lamp"]
`);
    const scenes = { ...TRAIL_SCENES, 'res://base.tscn': base };

    it('registers the %Name in the table of the root where the walk finds nothing in the instance', () => {
      expect(pathsEnding(inheritingHost('Player/Gone'), 'Shade', scenes)).toEqual(['Main/Lamp/Shade']);
    });

    it('registers it in the table of the instance where the walk finds the owner there', () => {
      expect(pathsEnding(inheritingHost('Player/Inner'), 'Shade', scenes)).toEqual(['Main/_Lamp#Shade']);
    });
  });

  it('gives the node no owner where the other instance is written after the heading', () => {
    const host = playerHost(lamp('Player/Gone', 'Other/Inner/%Lamp') + other);

    expect(pathsEnding(host, 'Shade')).toEqual(['Main/Other_Inner__Lamp#Shade']);
  });
});

describe('a heading whose parent= enters an instance and finds nothing there', () => {
  /** `Cap` names a node `Player` lacks, and carries `trail`; `Mid` holds the id 5 beside it. */
  const gone = (
    trail: string,
    parent = 'Player/Gone'
  ) => `[node name="Mid" type="Node3D" parent="." unique_id=5]

[node name="Cap" type="Node3D" parent="${parent}" parent_id_path=PackedInt32Array(${trail})]`;

  it('seats the heading under the heading of this file its trail names', () => {
    expect(pathsEnding(playerHost(gone('5')), 'Cap')).toEqual(['Main/Mid/Cap']);
  });

  it('seats the heading under the node its trail finds in the instance', () => {
    expect(pathsEnding(playerHost(gone(`${PLAYER_ID}, ${INNER_ID}`)), 'Cap')).toEqual([
      'Main/Player/Inner/Cap',
    ]);
  });

  it('re-roots the heading where its trail finds nothing', () => {
    expect(pathsEnding(playerHost(gone('9999')), 'Cap')).toEqual(['Main/Player_Gone#Cap']);
  });

  it('keeps the heading where its parent= walk finds a node, and reads no trail', () => {
    expect(pathsEnding(playerHost(gone('5', 'Player/Inner')), 'Cap')).toEqual(['Main/Player/Inner/Cap']);
  });

  it('follows the trail for a walk that fails in a nested instance', () => {
    expect(pathsEnding(playerHost(gone('5', 'Player/Inner/Gone')), 'Cap')).toEqual(['Main/Mid/Cap']);
  });

  it('follows the trail in the base of a root that inherits one, where no heading of the file holds the id', () => {
    const base = parseScene(`[gd_scene format=3]

[node name="Base" type="Node3D" unique_id=1]

[node name="Deep" type="Node3D" parent="." unique_id=77]
`);
    const inheriting = parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Main" instance=ExtResource("base")]

[node name="Cap" type="Node3D" parent="Nope" parent_id_path=PackedInt32Array(77)]
`);

    expect(pathsEnding(inheriting, 'Cap', { 'res://base.tscn': base })).toEqual(['Main/Deep/Cap']);
  });

  it('keeps the heading in the root, not re-rooted, while a scene the trail enters in the base is not loaded', () => {
    const base = parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://deep.tscn" id="deep"]

[node name="Base" type="Node3D" unique_id=1]

[node name="Deep" parent="." instance=ExtResource("deep") unique_id=77]
`);
    const inheriting = parseScene(`[gd_scene format=3]

[ext_resource type="PackedScene" path="res://base.tscn" id="base"]

[node name="Main" instance=ExtResource("base")]

[node name="Cap" type="Node3D" parent="Nope" parent_id_path=PackedInt32Array(77, 5)]
`);

    expect(pathsEnding(inheriting, 'Cap', { 'res://base.tscn': base })).toEqual(['Main/Cap']);
  });
});

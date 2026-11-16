// Both answers kept: the list fails once V8 and Godot's glibc agree or differ otherwise.
export const LIBM_DIFFERENCES = {
  'utility tan 1': {
    godot: 'f79ea3ee1e6e2eb3f',
    port: 'f78ea3ee1e6e2eb3f',
    reason: 'tan(7): glibc gives 0.8714479827243188, V8 the double one unit in the last place below',
  },
  'member-edge 79 "Color(0.3, 0.1, 0.8).ok_hsl_h"': {
    godot: 'f000000206b29e93f',
    port: 'f000000406b29e93f',
    reason:
      'atan2f in srgb_to_okhsl: glibc gives the float 0.786305964, V8 atan2 rounded to float the one above',
  },
  'method-edge 427 "Quaternion(0.1, 0.2, 0.3, 0.927362).get_euler(1)"': {
    godot: 'Vector3(f000000e02158d73f, f0000000005e0e03f, f000000c07b5de13f)',
    port: 'Vector3(f000000e02158d73f, f0000000005e0e03f, f000000e07b5de13f)',
    reason:
      'asinf in get_euler: glibc gives the float 0.54266155, the correctly rounded arc sine the one above',
  },
  'method-edge 444 "Basis(Vector3(0, 0.6, -0.8), Vector3(1, 0, 0), Vector3(0, -0.8, -0.6)).get_euler(5)"': {
    godot: 'Vector3(f00000060fb210940, f0000000067aced3f, f00000060fb21f93f)',
    port: 'Vector3(f00000060fb210940, f0000002067aced3f, f00000060fb21f93f)',
    reason:
      'asinf in get_euler: glibc gives the float 0.92729521, the correctly rounded arc sine the one above',
  },
};

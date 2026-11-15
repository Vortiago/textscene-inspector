/** The emitter reads `while (true)` as its one loop and no `switch`. The tree check and the guide read it. */
export const LOWERED_AWAY = {
  FLOW_OP_FOR: { keyword: 'for', name: 'a for loop' },
  FLOW_OP_DO: { keyword: 'do', name: 'a do loop' },
  FLOW_OP_SWITCH: { keyword: 'switch', name: 'a switch' },
};

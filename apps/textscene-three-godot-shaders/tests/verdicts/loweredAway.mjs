/**
 * The flows the lowering removes, with the keyword a shader writes for each and the name a fault
 * gives it. The emitter reads `while (true)` as its one loop and no `switch`. The lowered tree
 * check and the testing guide read this one list.
 */
export const LOWERED_AWAY = {
  FLOW_OP_FOR: { keyword: 'for', name: 'a for loop' },
  FLOW_OP_DO: { keyword: 'do', name: 'a do loop' },
  FLOW_OP_SWITCH: { keyword: 'switch', name: 'a switch' },
};

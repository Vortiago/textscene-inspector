/**
 * The first drawn tab (`TabBar::offset`) a TabBar's load left, when the Control that places the bar
 * replays that load itself, as TabContainer does (`tabcontainer/loadStrip.ts`). Godot has no static
 * answer for it: the order of the load events decides it.
 */
import { defineChannel } from '../../../../r3f/controls/native/solveHandoff';

export const tabBarLoadedOffset = defineChannel<number>('tabBarLoadedOffset');

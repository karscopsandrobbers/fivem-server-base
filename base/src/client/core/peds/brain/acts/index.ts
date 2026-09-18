/* Every activity, and the performer that puts it on a ped. */
import { ACTIVITY, ActivityKind } from '@shared/peds/pedBrain';
import { fight } from './fight';
import { idle } from './idle';
import type { Performer } from './performer';
import { phone } from './phone';
import { cower, dead, down, flee, hide, kneel, surrender, wary } from './reactions';

export type { Performer, Scratch } from './performer';
export { playerPedOf } from './performer';

export const PERFORMERS: Readonly<Record<ActivityKind, Performer>> = Object.freeze({
	[ACTIVITY.IDLE]: idle,
	[ACTIVITY.COWER]: cower,
	[ACTIVITY.KNEEL]: kneel,
	[ACTIVITY.HIDE]: hide,
	[ACTIVITY.WARY]: wary,
	[ACTIVITY.FLEE]: flee,
	[ACTIVITY.PHONE]: phone,
	[ACTIVITY.SURRENDER]: surrender,
	[ACTIVITY.FIGHT]: fight,
	[ACTIVITY.DOWN]: down,
	[ACTIVITY.DEAD]: dead,
});

/*
 * A guard: paid to be there, and draws on whoever points a weapon at him. Shot at, he keeps
 * fighting; left alone for long enough, he walks back to his post.
 */
import { ACTIVITY, FightParams, PED_ROLE } from '@shared/peds/pedBrain';
import { getTimestamp } from '@shared/index';
import { pedBrain } from './brain';

/** The relationship group every guard fights from; the group does not hate itself. */
export const GUARD_GROUP = 'BASE_GUARDS';

/** How long a guard keeps a fight going after the last provocation. */
const FIGHT_SECONDS = 45;

const GUARD_FIGHT: FightParams = {
	weapon: 'WEAPON_PISTOL',
	group: GUARD_GROUP,
	ability: 2,
	accuracy: 40,
	firingPattern: 'FIRING_PATTERN_BURST_FIRE_PISTOL',
	movement: 1,
	range: 1,
	neverFlee: true,
};

pedBrain.onAimedAt(PED_ROLE.GUARD, (brain, playerId) => {
	pedBrain.request(brain.handle, ACTIVITY.FIGHT, { target: playerId, until: getTimestamp() + FIGHT_SECONDS, params: { ...GUARD_FIGHT } });
});

pedBrain.onReport(PED_ROLE.GUARD, (brain, report, kind) => {
	if(report === 'dead') {
		globalThis.mp.logger.info(`[guards]: guard #${brain.handle} was killed.`);
	} else if(report === 'done' && kind === ACTIVITY.FIGHT) {
		globalThis.mp.logger.debug(`[guards]: guard #${brain.handle} stood down.`);
	}
});

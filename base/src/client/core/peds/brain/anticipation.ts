/*
 * Seeing it coming. A drawn weapon is noticed a long way out by the people who could actually
 * see it, and they stop and watch. Nothing follows from it, most of the time: that is the point.
 * WARY, as a reflex: it outranks nothing worth keeping and loses to everything that matters.
 */
import { ACTIVITY, BRAIN } from '@shared/peds/pedBrain';
import { directedKind, reflex, reflexKind } from './index';
import { PedSnapshot, ambientPeople, isArmedOrHostile, nearbyPeds } from './perception';
import { Delay, localPlayer } from '../../player/nativeHooks';

/** ped handle -> when it may next look up. */
const looked = new Map<number, number>();

const armed = (ped: number): boolean => {
	const [, weapon] = GetCurrentPedWeapon(ped, true) as unknown as [boolean, number];

	return (weapon >>> 0) !== (GetHashKey('WEAPON_UNARMED') >>> 0);
};

/** Are they facing you at all? Somebody with their back to the street does not notice the gun. */
const facing = (person: PedSnapshot, x: number, y: number): boolean => {
	const bearing = ((GetHeadingFromVector_2d(x - person.x, y - person.y) - GetEntityHeading(person.ped) + 540) % 360) - 180;

	return Math.abs(bearing) <= BRAIN.ANTICIPATION.FIELD_OF_VIEW_DEGREES / 2;
};

const prune = (now: number): void => {
	for(const [ped, until] of looked) {
		if(now >= until || !DoesEntityExist(ped)) {
			looked.delete(ped);
		}
	}
};

void (async (): Promise<void> => {
	for(;;) {
		await Delay(BRAIN.PERCEPTION_MS);
		if(!localPlayer.isSpawned()) {
			looked.clear();
			continue;
		}

		const me = PlayerPedId();

		if(!armed(me) || IsPedInAnyVehicle(me, false)) {
			continue;
		}

		const now = GetGameTimer();

		prune(now);

		const [px, py] = GetEntityCoords(me, true);
		const serverId = GetPlayerServerId(PlayerId());

		for(const person of ambientPeople(nearbyPeds())) {
			if(!person.mine || looked.has(person.ped)) {
				continue;
			}
			if(directedKind(person.ped) !== null || reflexKind(person.ped) !== null) {
				continue;
			}
			// The stare clears the ped's tasks; on anybody shooting at you that is the end of the fight.
			if(isArmedOrHostile(person.ped)) {
				continue;
			}
			if(person.distance > BRAIN.ANTICIPATION.NOTICE_RANGE || !facing(person, px, py)) {
				continue;
			}
			if(reflex(person.ped, ACTIVITY.WARY, { target: serverId, until: Date.now() / 1000 + BRAIN.ANTICIPATION.SECONDS })) {
				looked.set(person.ped, now + BRAIN.ANTICIPATION.COOLDOWN_MS);
			}
		}
	}
})();

/*
 * Panic spreads. Anybody near somebody who is visibly frightened may catch it: a reflex, never on
 * the bag. It only spreads from somebody genuinely panicking, is capped at MAX_DEPTH hops from
 * whoever started it, and a person who has just caught it cannot catch it again for a while.
 */
import { ACTIVITY, ActivityKind, BRAIN } from '@shared/peds/pedBrain';
import { directedKind, isDirected, onPedDebug, reflex, reflexKind } from './index';
import { PedSnapshot, ambientPeople, isArmedOrHostile, nearbyPeds } from './perception';
import { Delay, localPlayer } from '../../player/nativeHooks';

/** What counts as visibly frightened. Hands up is not: that is compliance. */
const PANIC: ReadonlySet<ActivityKind> = new Set([ACTIVITY.FLEE, ACTIVITY.COWER, ACTIVITY.HIDE]);

const caught = new Map<number, { depth: number; panicUntil: number; until: number }>();

const activityOf = (ped: number): ActivityKind | null => directedKind(ped) ?? reflexKind(ped);

const depthOf = (ped: number, now: number): number => {
	if(isDirected(ped)) {
		return 0;
	}

	const entry = caught.get(ped);

	return entry && now < entry.panicUntil ? entry.depth : 0;
};

const spreadFrom = (source: PedSnapshot, people: PedSnapshot[], now: number, budget: number): number => {
	const depth = depthOf(source.ped, now) + 1;
	let started = 0;

	if(depth > BRAIN.CONTAGION.MAX_DEPTH) {
		return 0;
	}
	for(const person of people) {
		if(started >= budget) {
			break;
		}
		if(person.ped === source.ped || !person.mine) {
			continue;
		}

		const entry = caught.get(person.ped);

		if(entry && now < entry.until) {
			continue;
		}
		if(activityOf(person.ped) !== null || isArmedOrHostile(person.ped)) {
			continue;
		}

		const gap = Math.hypot(person.x - source.x, person.y - source.y, person.z - source.z);

		if(gap > BRAIN.CONTAGION.RANGE) {
			continue;
		}
		// Nearer is likelier, falling to nothing at the edge of the range.
		if(Math.random() > BRAIN.CONTAGION.CHANCE * (1 - gap / BRAIN.CONTAGION.RANGE)) {
			continue;
		}
		if(reflex(person.ped, ACTIVITY.FLEE, {
			at: { x: source.x, y: source.y, z: source.z },
			until: Date.now() / 1000 + BRAIN.CONTAGION.SECONDS,
			params: { distance: BRAIN.FLEE_DISTANCE },
		})) {
			const panicUntil = now + BRAIN.CONTAGION.SECONDS * 1000;

			caught.set(person.ped, { depth, panicUntil, until: panicUntil + BRAIN.CONTAGION.COOLDOWN_MS });
			started++;
		}
	}
	return started;
};

const prune = (now: number): void => {
	for(const [ped, entry] of caught) {
		if(now >= entry.until || !DoesEntityExist(ped)) {
			caught.delete(ped);
		}
	}
};

void (async (): Promise<void> => {
	for(;;) {
		await Delay(BRAIN.PERCEPTION_MS);
		if(!localPlayer.isSpawned()) {
			caught.clear();
			continue;
		}

		const now = GetGameTimer();

		prune(now);

		const people = ambientPeople(nearbyPeds());
		const sources = people.filter(person => {
			const kind = activityOf(person.ped);

			return kind !== null && PANIC.has(kind);
		});

		if(!sources.length) {
			continue;
		}

		let budget = BRAIN.CONTAGION.MAX_PER_PASS;

		for(const source of sources) {
			budget -= spreadFrom(source, people, now, budget);
			if(budget <= 0) {
				break;
			}
		}
	}
})();

onPedDebug((entry: PedSnapshot) => {
	const caughtIt = caught.get(entry.ped);

	return caughtIt ? `~o~caught panic~s~ (hop ${caughtIt.depth} of ${BRAIN.CONTAGION.MAX_DEPTH})` : null;
});

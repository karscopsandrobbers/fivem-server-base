/*
 * E on a bin or a dumpster: the server rolls what is in it. The prop travels as a model and a
 * position, so one of a thousand identical bins can be told from the next and searched once.
 */
import { EVENTS } from '@shared/events';
import { getRandomInt, getRandomOfArraySet } from '@shared/index';

/** How long a prop stays empty after a search. */
const SEARCHED_FOR_MS = 10 * 60 * 1000;
/** How close the player has to be to the prop they claim to be searching. */
const REACH = 3.5;
/** Odds out of 100 of finding anything. */
const FIND_CHANCE = 40;

const FINDS = ['a half-eaten sandwich', 'a crumpled dollar', 'an old phone charger', 'a lottery ticket', 'a rusty knife', 'a bag of bottle caps'];

interface PropTarget {
	model: string;
	x: number;
	y: number;
	z: number;
}

const searched = new Map<string, number>();

const keyOf = (target: PropTarget): string => `${target.model}:${target.x.toFixed(1)}:${target.y.toFixed(1)}:${target.z.toFixed(1)}`;

onNet(EVENTS.SERVER_PROP_SEARCH, (target: unknown) => {
	const player = globalThis.mp.players.at(source);
	const prop = target as PropTarget | null;

	if(!player?.isSpawned() || !prop || typeof prop.model !== 'string' || typeof prop.x !== 'number') {
		return;
	}

	const at = player.position;

	if(Math.hypot(at.x - prop.x, at.y - prop.y, at.z - prop.z) > REACH) {
		return;
	}

	const key = keyOf(prop);
	const now = Date.now();

	if(now - (searched.get(key) ?? -Infinity) < SEARCHED_FOR_MS) {
		player.languageNotify('PROP_SEARCHED_RECENTLY');
		return;
	}
	searched.set(key, now);
	player.playAnimation('amb@prop_human_bum_bin@idle_a', 'idle_a', 8.0, 1, 3000);

	if(getRandomInt(1, 100) <= FIND_CHANCE) {
		player.languageNotify('PROP_SEARCHED_FOUND', getRandomOfArraySet(FINDS));
	} else {
		player.languageNotify('PROP_SEARCHED_NOTHING');
	}
});

// A search is forgotten after its time; the map is kept small.
setInterval(() => {
	const now = Date.now();

	for(const [key, at] of searched) {
		if(now - at >= SEARCHED_FOR_MS) {
			searched.delete(key);
		}
	}
}, 60000);

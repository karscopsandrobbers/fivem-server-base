/*
 * A state bag as a plain object: `player.data.money = 5` replicates, `player.data.money` reads.
 *
 * Reads come from a write-through cache, not the bag: a bag read hands back a msgpack copy, and
 * null once the entity is gone. Writes pass `replicate = true` explicitly, because Legacy
 * replicates by default and FiveM for GTAV Enhanced only when asked.
 *
 * Bags are SHALLOW: only a whole top-level key assignment replicates. Never mutate a nested
 * object in place; rebuild it and assign the key.
 */
export const createStateProxy = (bag: any): Record<string, any> => {
	const cache: Record<string, any> = Object.create(null);

	return new Proxy(cache, {
		get: (target, key) => {
			if(typeof key !== 'string') {
				return undefined;
			}
			return key in target ? target[key] : bag[key];
		},
		set: (target, key, value) => {
			if(typeof key === 'string') {
				target[key] = value;
				bag.set(key, value, true);
			}
			return true;
		},
		deleteProperty: (target, key) => {
			if(typeof key === 'string') {
				delete target[key];
				bag.set(key, null, true);
			}
			return true;
		},
		has: (target, key) => {
			if(typeof key !== 'string') {
				return false;
			}
			const value = key in target ? target[key] : bag[key];

			return value !== undefined && value !== null;
		},
	});
};

export default createStateProxy;

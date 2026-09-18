/*
 * Who a ped is, as three numbers. The brain decides what a ped DOES; this decides what sort of
 * person is doing it: the beat before somebody obeys, the odds they are the one who tries something.
 *
 * Deliberately not a change to PRIORITY: that table is a total order the whole brain leans on.
 */

/** 0 to 1, each. The middle is unremarkable; the ends are the person you remember. */
export interface PedTraits {
	/** Holding it together. Low panics and obeys instantly; high hesitates and may try something. */
	nerve: number;
	/** What they hold on to. */
	greed: number;
	/** Who they stand by. */
	loyalty: number;
}

export const NEUTRAL_TRAITS: Readonly<PedTraits> = Object.freeze({ nerve: 0.5, greed: 0.5, loyalty: 0.5 });

export const PED_TRAITS = Object.freeze({
	/** How far a trait moves a weight, at the extremes. */
	SWING: 0.6,
	/** The beat before somebody does as they are told. Nerve decides where in this range they land. */
	HESITATION_MS: Object.freeze([0, 1400]),
	FRIGHTENED_BELOW: 0.25,
	CALM_ABOVE: 0.75,
});

/** The same ped is the same person every time: rolled from its identity rather than Math.random. */
export const traitsFor = (seed: number): PedTraits => {
	const hash = (salt: number): number => {
		let value = (seed ^ salt) >>> 0;

		value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
		value = Math.imul(value ^ (value >>> 16), 0x45d9f3b) >>> 0;
		return ((value ^ (value >>> 16)) >>> 0) / 0xffffffff;
	};

	return { nerve: hash(0x9e37), greed: hash(0x85eb), loyalty: hash(0xc2b2) };
};

/** Scale a weight by a trait: 0 gives the least of it, 1 the most, 0.5 leaves it alone. */
export const weighByTrait = (weight: number, trait: number, against = false): number => {
	const shift = (trait - 0.5) * 2 * PED_TRAITS.SWING;

	return Math.max(0, weight * (1 + (against ? -shift : shift)));
};

/** How long this person takes to do as they are told. The calmer they are, the longer they think. */
export const hesitationOf = (traits: PedTraits): number => {
	const [min, max] = PED_TRAITS.HESITATION_MS;

	return Math.round(min + (max - min) * traits.nerve);
};

/** In words, for the debug overlay. */
export const describeTraits = (traits: PedTraits): string => {
	const notes: string[] = [];

	if(traits.nerve <= PED_TRAITS.FRIGHTENED_BELOW) {
		notes.push('shaky');
	} else if(traits.nerve >= PED_TRAITS.CALM_ABOVE) {
		notes.push('steady');
	}
	if(traits.greed >= PED_TRAITS.CALM_ABOVE) {
		notes.push('grasping');
	}
	if(traits.loyalty >= PED_TRAITS.CALM_ABOVE) {
		notes.push('loyal');
	}
	return notes.join(', ');
};

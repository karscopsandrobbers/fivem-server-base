/* Small helpers both bundles use. */

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const getRandomInt = (min = 0, max = 100): number => Math.floor(Math.random() * (max - min + 1)) + min;

export const getRandomOfArraySet = <T>(array: readonly T[]): T => array[Math.floor(Math.random() * array.length)];

/** Wraps an angle into [0, 360). */
export const angleClamp360 = (angle: number): number => ((angle % 360) + 360) % 360;

export const numberFormat = (num: number): string => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Seconds since the epoch. */
export const getTimestamp = (): number => Math.floor(Date.now() / 1000);

export const degToRad = (degrees: number): number => degrees * (Math.PI / 180.0);

/** The point `distance` ahead of `position` along `heading`. */
export const xyInFrontOfPos = <T extends { x: number; y: number; z: number }>(position: T, heading: number, distance: number): T => {
	const radians = degToRad(heading);

	return {
		...position,
		x: position.x + distance * -Math.sin(radians),
		y: position.y + distance * Math.cos(radians),
	};
};

export const getDistanceBetweenPositions = (
	a: { x: number; y: number; z: number },
	b: { x: number; y: number; z: number },
): number => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

/** joaat of a model or weapon name, as an unsigned 32-bit number, on either side. */
export const hashOf = (name: string): number => GetHashKey(name) >>> 0;

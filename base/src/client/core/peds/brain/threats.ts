/*
 * How many threat reactions this client's scripts start on the peds it controls. Every flee,
 * cower and combat task is a network threat event, and a client that queues too many crashes.
 * A loud minute is said in F8, by where it came from.
 */
const WINDOW_MS = 60000;
const LOUD = 90;

const counts = new Map<string, number>();

export const noteThreatTask = (source: string): void => {
	counts.set(source, (counts.get(source) ?? 0) + 1);
};

setInterval(() => {
	const total = [...counts.values()].reduce((sum, count) => sum + count, 0);

	if(total > LOUD) {
		const bySource = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => `${source} ${count}`).join(', ');

		console.log(`[peds] ${total} threat tasks started in the last minute: ${bySource}`);
	}
	counts.clear();
}, WINDOW_MS);

/*
 * Ticks that exist only while they are needed, and one shared resource-stop listener.
 *
 * A per-frame loop that belongs to something usually off should not run every frame to check a
 * flag and return. `createGatedTick` polls a predicate a few times a second and starts and stops
 * the tick around it, so a closed feature costs nothing.
 */
export interface ManagedTick {
	start(): void;
	stop(): void;
	readonly running: boolean;
}

export const createManagedTick = (handler: () => void): ManagedTick => {
	let id: number | null = null;

	return {
		start(): void {
			if(id === null) {
				id = setTick(handler);
			}
		},
		stop(): void {
			if(id !== null) {
				clearTick(id);
				id = null;
			}
		},
		get running(): boolean {
			return id !== null;
		},
	};
};

/** `pollMs` is the longest the feature waits to come alive after its flag flips. */
export const createGatedTick = (isActive: () => boolean, handler: () => void, pollMs = 250): ManagedTick => {
	const tick = createManagedTick(handler);

	setInterval(() => {
		if(isActive()) {
			if(!tick.running) {
				tick.start();
			}
		} else if(tick.running) {
			tick.stop();
		}
	}, pollMs);

	return tick;
};

type StopHandler = (resourceName: string) => void;

const stopHandlers: StopHandler[] = [];

/** One listener for everyone: FiveM warns at eleven listeners on the same event name. */
export const onResourceStop = (handler: StopHandler): void => {
	stopHandlers.push(handler);
};

on('onResourceStop', (resource: string) => {
	if(GetCurrentResourceName() !== resource) {
		return;
	}
	for(const handler of stopHandlers) {
		try {
			handler(resource);
		} catch(error) {
			console.warn(`[lifecycle] onResourceStop handler failed: ${String(error)}`);
		}
	}
});

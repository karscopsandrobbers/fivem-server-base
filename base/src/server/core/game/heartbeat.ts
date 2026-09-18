/*
 * The server's own second: one real-time beat every per-second job registers on. A throw in one
 * handler is logged and does not take the others down, and an async handler that outlives its
 * interval skips a beat rather than running on top of itself.
 */
const TICK_MS = 1000;
/** A beat that lands this much early still counts as on time. */
const EARLY_MS = 100;

type TickHandler = () => void | Promise<void>;

interface Registered {
	name: string;
	run: TickHandler;
	everyMs: number;
	lastRun: number;
	busy: boolean;
}

const handlers: Registered[] = [];

/** Run this on its own beat, for as long as the resource lives. The name is for the log when it throws. */
export const everyTick = (name: string, everyMs: number, run: TickHandler): void => {
	handlers.push({ name, run, everyMs, lastRun: 0, busy: false });
};

export const everySecond = (name: string, run: TickHandler): void => everyTick(name, TICK_MS, run);

const runHandler = (handler: Registered, now: number): void => {
	if(handler.busy || now - handler.lastRun < handler.everyMs - EARLY_MS) {
		return;
	}
	handler.lastRun = now;
	try {
		const result = handler.run();

		if(result instanceof Promise) {
			handler.busy = true;
			void result
				.catch((err: unknown) => globalThis.mp.logger.error(`[heartbeat]: ${handler.name} failed: ${String(err)}`))
				.finally(() => {
					handler.busy = false;
				});
		}
	} catch(err) {
		globalThis.mp.logger.error(`[heartbeat]: ${handler.name} failed: ${String(err)}`);
	}
};

setInterval(() => {
	const now = Date.now();

	for(const handler of handlers) {
		runHandler(handler, now);
	}
	emit('onServerSecond');
}, TICK_MS);

/*
 * The two message screens GTA draws through scaleforms: the big freemode shard ("WASTED" is one
 * of these) and the midsized message. Each is one movie, shown for a while and then let go.
 */
import { EVENTS } from '@shared/events';
import { Scaleform } from '../scaleform';

interface Screen {
	movie: string;
	handle: Scaleform | null;
	until: number;
	tick: number | null;
}

const big: Screen = { movie: 'MP_BIG_MESSAGE_FREEMODE', handle: null, until: 0, tick: null };
const midsized: Screen = { movie: 'MIDSIZED_MESSAGE', handle: null, until: 0, tick: null };

const stop = (screen: Screen): void => {
	if(screen.tick !== null) {
		clearTick(screen.tick);
		screen.tick = null;
	}
	screen.handle?.dispose();
	screen.handle = null;
};

const start = async (screen: Screen, method: string, durationMs: number, args: Array<string | number | boolean>): Promise<void> => {
	stop(screen);

	const handle = new Scaleform(screen.movie);

	screen.handle = handle;
	if(!await handle.waitUntilLoaded()) {
		stop(screen);
		return;
	}
	handle.callFunction(method, ...args);
	screen.until = GetGameTimer() + durationMs;
	screen.tick = setTick(() => {
		if(GetGameTimer() >= screen.until) {
			stop(screen);
			return;
		}
		handle.renderFullscreen();
	});
};

/** The big freemode message: a title and a subtitle, with a transition out. */
export const showShard = (title: string, subtitle = '', durationMs = 5000): void => {
	void start(big, 'SHOW_SHARD_WASTED_MP_MESSAGE', durationMs, [title, subtitle, 5, true, true]);
};

export const showMidsizedMessage = (title: string, subtitle = '', durationMs = 5000): void => {
	void start(midsized, 'SHOW_MIDSIZED_MESSAGE', durationMs, [title, subtitle]);
};

onNet(EVENTS.GUI_SHARD, (title: unknown, subtitle: unknown, durationMs: unknown) => {
	if(typeof title === 'string') {
		showShard(title, typeof subtitle === 'string' ? subtitle : '', typeof durationMs === 'number' ? durationMs : 5000);
	}
});

onNet(EVENTS.GUI_MIDSIZED, (title: unknown, subtitle: unknown, durationMs: unknown) => {
	if(typeof title === 'string') {
		showMidsizedMessage(title, typeof subtitle === 'string' ? subtitle : '', typeof durationMs === 'number' ? durationMs : 5000);
	}
});


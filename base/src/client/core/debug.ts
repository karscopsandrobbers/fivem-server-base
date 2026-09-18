/*
 * Debug channels: a named switch a debug overlay reads before it draws, so the one thing you are
 * chasing is not buried under six others. A channel filters WITHIN debug mode (the server's
 * /debug); with debug mode off nothing draws regardless.
 *
 *   /debugchannel           lists them
 *   /debugchannel peds      toggles one
 */
import { localPlayer } from './player/nativeHooks';

export const DEBUG_CHANNELS = {
	/** Every ped around you: its brain, any reflex, whose client performs it. */
	peds: 'Ped brain: role, activity, control',
	/** Every floating prompt definition and what it has on screen. */
	prompts: 'Floating prompts',
	/** Objective marker tracking. */
	objectiveMarkers: 'Objective markers',
	/** Handle, net id and position over every vehicle around you. */
	vehicles: 'Vehicle ids and positions',
} as const;

export type DebugChannel = keyof typeof DEBUG_CHANNELS;

const enabled = new Map<DebugChannel, boolean>((Object.keys(DEBUG_CHANNELS) as DebugChannel[]).map(key => [key, true]));

export const isDebugChannelOn = (channel: DebugChannel): boolean => enabled.get(channel) !== false;

export const setDebugChannel = (channel: DebugChannel, on: boolean): void => {
	enabled.set(channel, on);
};

/** Debug mode AND the channel: what every overlay asks. */
export const debugging = (channel: DebugChannel): boolean => localPlayer.isInDebugMode() && isDebugChannelOn(channel);

RegisterCommand('debugchannel', (_source: number, args: string[]) => {
	const channel = args[0] as DebugChannel | undefined;

	if(channel && channel in DEBUG_CHANNELS) {
		setDebugChannel(channel, !isDebugChannelOn(channel));
		console.log(`[debug]: ${channel} is now ${isDebugChannelOn(channel) ? 'on' : 'off'}.`);
		return;
	}
	for(const [key, description] of Object.entries(DEBUG_CHANNELS)) {
		console.log(`[debug]: ${key} (${isDebugChannelOn(key as DebugChannel) ? 'on' : 'off'}): ${description}`);
	}
}, false);

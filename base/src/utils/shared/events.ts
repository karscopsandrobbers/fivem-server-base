/*
 * Net event names shared by the client and server bundles. Every wire name lives here so a typo
 * on one side cannot silently miss the other.
 */
export const EVENTS = {
	/** Client -> server: a line for the server log. */
	CLIENT_FEEDBACK: 'base:client:log',

	/** Client -> server: the session is up, spawn me. */
	PLAYER_READY: 'base:player:ready',
	/** Server -> client: spawn at this position. */
	PLAYER_SPAWN: 'base:player:spawn',
	/** Client -> server: the spawn routine finished. */
	PLAYER_SPAWNED: 'base:player:spawned',
	/** Client -> server: the local ped died. */
	PLAYER_DIED: 'base:player:died',
	/** Client -> server: street and zone, a few times a minute. */
	PLAYER_UPDATE_LOCATION: 'base:player:location',

	/** Server -> every client: run a client-only native on an entity, by net id. */
	TASK_RUN: 'base:task:run',

	/** The stock chat resource's message event. */
	CHAT_MESSAGE: 'chat:addMessage',
	/** Server -> client: a HUD notification, `~r~` colour codes. */
	NOTIFY: 'base:gui:notify',
	/** Server -> client: the bottom-centre help text. */
	DISPLAY_HELP: 'base:gui:help',
	/** Server -> client: the big freemode shard (title, subtitle). */
	GUI_SHARD: 'base:gui:shard',
	/** Server -> client: the midsized message (title, subtitle). */
	GUI_MIDSIZED: 'base:gui:midsized',
	/** Server -> client: a frontend sound on this client only. */
	SOUND_FRONTEND: 'base:sound:frontend',

	/** Client -> server: what came of a ped activity this client performs. */
	SERVER_PED_REPORT: 'base:peds:report',
	/** Client -> server: a weapon is on this ped (net id). */
	SERVER_PED_AIMED_AT: 'base:peds:aimedAt',
	/** Client -> server: the weapon has been held on the same ped for a while. */
	SERVER_PED_AIM_HELD: 'base:peds:aimHeld',
	/** Client -> server: E on a ped. */
	SERVER_PED_TALK: 'base:peds:talk',

	/** Client -> server: E on a vehicle. */
	SERVER_VEHICLE_TOGGLE_LOCK: 'base:vehicles:toggleLock',
	/** Client -> server: E on a bin or dumpster. */
	SERVER_PROP_SEARCH: 'base:world:searchProp',
} as const;

export type EventName = typeof EVENTS[keyof typeof EVENTS];

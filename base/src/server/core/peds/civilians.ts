/*
 * The city's own people, as the brain sees them: a weapon on one puts their hands up, a weapon
 * held on them sends them running, and E on one has them turn and nod. The client only ever
 * names a ped by NET id; the server resolves it, checks the distance, and takes the ped for as
 * long as the reaction lasts.
 */
import { EVENTS } from '@shared/events';
import { ACTIVITY, BRAIN, PED_ROLE } from '@shared/peds/pedBrain';
import { TASKS } from '@shared/tasks';
import { getTimestamp } from '@shared/index';
import type EntityPlayer from '../entities/PlayerEntity';
import { isNearPed, pedBrain } from './brain';

/** How long the hands stay up once the gun is on them, and how long the run lasts. */
const SURRENDER_SECONDS = 20;
const FLEE_SECONDS = 25;

/** The game's own person behind a net id, brought under the brain if nobody has it. */
const takeCivilian = (netId: number): number => {
	const handle = NetworkGetEntityFromNetworkId(netId);

	if(!handle || !DoesEntityExist(handle) || GetEntityType(handle) !== 1 || IsPedAPlayer(handle)) {
		return 0;
	}
	// A server-placed ped already answers to its own role; only an unowned one is taken.
	const brain = pedBrain.byHandle(handle) ?? pedBrain.adopt(handle, PED_ROLE.CIVILIAN, { ambient: true });

	return brain?.role === PED_ROLE.CIVILIAN ? handle : 0;
};

/** A weapon comes onto somebody: hands up, for a while. */
onNet(EVENTS.SERVER_PED_AIMED_AT, (netId: unknown) => {
	const player = globalThis.mp.players.at(source);

	if(!player?.isSpawned() || typeof netId !== 'number') {
		return;
	}

	const handle = takeCivilian(netId);

	if(handle && isNearPed(player, handle, BRAIN.AIM_RANGE * 1.5)) {
		pedBrain.request(handle, ACTIVITY.SURRENDER, { target: player.id, until: getTimestamp() + SURRENDER_SECONDS });
	}
});

/** The weapon stays on them: they break and run. */
pedBrain.onAimHeld(PED_ROLE.CIVILIAN, (brain, playerId) => {
	pedBrain.release(brain.handle, ACTIVITY.SURRENDER);
	pedBrain.request(brain.handle, ACTIVITY.FLEE, { target: playerId, until: getTimestamp() + FLEE_SECONDS, params: { distance: BRAIN.FLEE_DISTANCE } });
});

/** A reaction that ran its course: the person goes back to being nobody's. */
pedBrain.onReport(PED_ROLE.CIVILIAN, (brain, report) => {
	if(report === 'done' && brain.ambient && brain.stack.length === 1) {
		pedBrain.forget(brain.handle);
	}
});

/** E on a person: they turn to you and nod. Two tasks, so both go through the relay. */
onNet(EVENTS.SERVER_PED_TALK, (netId: unknown) => {
	const player: EntityPlayer | null = globalThis.mp.players.at(source);

	if(!player?.isSpawned() || typeof netId !== 'number') {
		return;
	}

	const handle = NetworkGetEntityFromNetworkId(netId);

	if(!handle || !DoesEntityExist(handle) || IsPedAPlayer(handle) || !isNearPed(player, handle, 4.0)) {
		return;
	}
	// Somebody with their hands up, or running, is not stopping for a chat.
	if(pedBrain.byHandle(handle) && pedBrain.busierThan(handle, ACTIVITY.COWER)) {
		return;
	}
	emitNet(EVENTS.TASK_RUN, -1, { netId, name: TASKS.TURN_TO_FACE_ENTITY, args: [player.netId, 3000] });
	emitNet(EVENTS.TASK_RUN, -1, { netId, name: TASKS.PLAY_ANIM, args: ['gestures@m@standing@casual', 'gesture_nod_yes_hard', 8.0, -8.0, -1, 48, 0.0, false, false, false] });
	player.notify('~g~They nod at you.');
});

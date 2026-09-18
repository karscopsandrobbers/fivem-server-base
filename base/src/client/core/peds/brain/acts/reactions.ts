/* The frightened acts: cowering, running, the hands going up; and the floor, and the body. */
import { BRAIN, BrainView, FleeParams } from '@shared/peds/pedBrain';
import { NEUTRAL_TRAITS, hesitationOf } from '@shared/peds/pedTraits';
import { loadAnimationDict } from '../../../../modules/utils';
import { playGassed, playWakeUp } from '../../gas';
import { isServerPed } from '../perception';
import { noteThreatTask } from '../threats';
import { paramsOf, playerPedOf, type Performer } from './performer';

/** How long somebody makes for the door before they are simply running, and how close counts as there. */
const DOOR = Object.freeze({ giveUpMs: 20000, reachedMetres: 2.0 });
const KNEEL = Object.freeze({ dict: 'random@arrests@busted', enter: 'enter', idle: 'idle_a' });
/** How long a hider looks for cover before crouching where they are. */
const COVER_SEARCH_MS = 6000;

/** Frightened people move by who they are: the shaky ones sprint, the steady ones walk fast. */
const fleeSpeedFor = (view: BrainView): number => {
	const nerve = (view.traits ?? NEUTRAL_TRAITS).nerve;

	return nerve < 0.35 ? 3.0 : nerve < 0.7 ? 2.0 : 1.3;
};

/** Away from the target or the place: the engine's own flee, which knows the streets. */
const runAway = (ped: number, view: BrainView): void => {
	const distance = paramsOf<FleeParams>(view).distance || BRAIN.FLEE_DISTANCE;
	const target = playerPedOf(view.target);

	SetBlockingOfNonTemporaryEvents(ped, false);
	ClearPedTasksImmediately(ped);
	noteThreatTask('flee');
	if(target) {
		TaskSmartFleePed(ped, target, distance, -1, false, false);
	} else if(view.at) {
		TaskSmartFleeCoord(ped, view.at.x, view.at.y, view.at.z, distance, -1, false, false);
	} else {
		const [x, y, z] = GetEntityCoords(ped, false);

		TaskSmartFleeCoord(ped, x, y, z, distance, -1, false, false);
	}
};

export const cower: Performer = {
	apply: ped => {
		SetBlockingOfNonTemporaryEvents(ped, true);
		ClearPedTasksImmediately(ped);
		TaskCower(ped, -1);
		noteThreatTask('cower');
		PlayPedAmbientSpeechNative(ped, 'GENERIC_FRIGHTENED_HIGH', 'SPEECH_PARAMS_FORCE_SHOUTED');
		return true;
	},
	clear: ped => {
		ClearPedTasks(ped);
	},
};

/** Running from a place. With a door to make for, a startled beat first, then the way out, then the run. */
export const flee: Performer = {
	apply: (ped, view, scratch, _previous, now) => {
		const { door } = paramsOf<FleeParams>(view);

		if(!door) {
			runAway(ped, view);
			PlayPedAmbientSpeechNative(ped, 'GENERIC_FRIGHTENED_HIGH', 'SPEECH_PARAMS_FORCE_SHOUTED');
			return true;
		}
		if(typeof scratch.startledAt !== 'number') {
			scratch.startledAt = now;
			SetBlockingOfNonTemporaryEvents(ped, true);
			ClearPedTasksImmediately(ped);
			TaskHandsUp(ped, 1500, 0, -1, false);
			noteThreatTask('startle');
			PlayPedAmbientSpeechNative(ped, 'GENERIC_FRIGHTENED_HIGH', 'SPEECH_PARAMS_FORCE_SHOUTED');
		}
		if(now - Number(scratch.startledAt) < hesitationOf(view.traits ?? NEUTRAL_TRAITS)) {
			return false;
		}
		ClearPedTasks(ped);
		TaskFollowNavMeshToCoord(ped, door.x, door.y, door.z, fleeSpeedFor(view), -1, 1.0, 0, 0.0);
		scratch.doorSince = now;
		return true;
	},
	tick: (ped, view, scratch, now) => {
		const { door } = paramsOf<FleeParams>(view);

		if(!door || typeof scratch.doorSince !== 'number') {
			return null;
		}

		const [x, y, z] = GetEntityCoords(ped, false);

		if(Vdist(x, y, z, door.x, door.y, door.z) <= DOOR.reachedMetres || now - scratch.doorSince >= DOOR.giveUpMs) {
			delete scratch.doorSince;
			runAway(ped, view);
		}
		return null;
	},
	clear: ped => {
		ClearPedTasks(ped);
	},
};

/** Somebody who has noticed a weapon: stopped, facing them. */
export const wary: Performer = {
	apply: (ped, view) => {
		const target = playerPedOf(view.target);

		if(!target) {
			return false;
		}
		SetBlockingOfNonTemporaryEvents(ped, true);
		ClearPedTasks(ped);
		TaskTurnPedToFaceEntity(ped, target, -1);
		return true;
	},
	clear: ped => {
		// A server ped's post keeps it deaf to gunfire; only the game's own people are handed back.
		if(!isServerPed(ped)) {
			SetBlockingOfNonTemporaryEvents(ped, false);
		}
		ClearPedTasks(ped);
	},
};

/** Down on their knees, and staying down. */
export const kneel: Performer = {
	apply: async (ped, _view, scratch, _previous, now) => {
		if(!await loadAnimationDict(KNEEL.dict) || !DoesEntityExist(ped)) {
			return false;
		}
		SetBlockingOfNonTemporaryEvents(ped, true);
		ClearPedTasksImmediately(ped);
		TaskPlayAnim(ped, KNEEL.dict, KNEEL.enter, 8.0, -8.0, -1, 2, 0, false, false, false);
		scratch.idleAt = now + GetAnimDuration(KNEEL.dict, KNEEL.enter) * 1000;
		return true;
	},
	tick: (ped, _view, scratch, now) => {
		if(now >= Number(scratch.idleAt ?? 0) && HasAnimDictLoaded(KNEEL.dict) && !IsEntityPlayingAnim(ped, KNEEL.dict, KNEEL.idle, 3)) {
			TaskPlayAnim(ped, KNEEL.dict, KNEEL.idle, 8.0, -8.0, -1, 1, 0, false, false, false);
		}
		return null;
	},
	clear: ped => {
		ClearPedTasks(ped);
	},
};

/** Behind the nearest cover from the target, and crouched where they stand if there is none. */
export const hide: Performer = {
	apply: (ped, view, scratch, _previous, now) => {
		const threat = playerPedOf(view.target);

		SetBlockingOfNonTemporaryEvents(ped, true);
		ClearPedTasksImmediately(ped);
		if(threat) {
			TaskSeekCoverFromPed(ped, threat, -1, false);
		} else {
			TaskCower(ped, -1);
		}
		PlayPedAmbientSpeechNative(ped, 'GENERIC_FRIGHTENED_HIGH', 'SPEECH_PARAMS_FORCE_SHOUTED');
		scratch.since = now;
		return true;
	},
	tick: (ped, _view, scratch, now) => {
		if(!scratch.settled && now - Number(scratch.since ?? now) >= COVER_SEARCH_MS && !IsPedInCover(ped, false)) {
			scratch.settled = true;
			TaskCower(ped, -1);
		}
		return null;
	},
	clear: ped => {
		ClearPedTasks(ped);
	},
};

/*
 * Hands up, after the beat before they go up. Instant compliance is the clearest tell that there is
 * nobody home; the pause is scaled to the person's nerve. Returning false is "ask me again next poll".
 */
export const surrender: Performer = {
	apply: (ped, view, scratch, _previous, now) => {
		const wait = hesitationOf(view.traits ?? NEUTRAL_TRAITS);

		if(wait > 0) {
			const since = typeof scratch.askedAt === 'number' ? scratch.askedAt : (scratch.askedAt = now);

			if(now - since < wait) {
				return false;
			}
		}
		// Deaf to the next gunshot, and the flee attributes off, or they walk out mid-hold-up.
		SetBlockingOfNonTemporaryEvents(ped, true);
		SetPedFleeAttributes(ped, 0, false);
		ClearPedTasksImmediately(ped);
		TaskHandsUp(ped, -1, 0, -1, false);
		return true;
	},
	clear: ped => {
		ClearPedTasks(ped);
	},
};

/** Face down until the server says otherwise. The game's own people get up when it clears; a server ped's post walks it home. */
export const down: Performer = {
	apply: ped => {
		void playGassed(ped);
		return true;
	},
	clear: async ped => {
		if(!isServerPed(ped)) {
			await playWakeUp(ped, true);
		}
	},
};

/** The body drops and stops animating. */
export const dead: Performer = {
	apply: ped => {
		ClearPedTasksImmediately(ped);
		SetPedCanRagdoll(ped, true);
		SetPedToRagdoll(ped, 4000, 4000, 0, false, false, false);
		return true;
	},
};

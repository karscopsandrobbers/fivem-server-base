/*
 * The post: what a ped does when nothing is being asked of it. A scenario in place, a scenario it
 * is warped onto, a looping clip, a clip pinned to a place, or nothing. Re-asserted every so
 * often, because a scenario is cancelled by any task that lands on the ped.
 */
import { ACTIVITY, IdleParams } from '@shared/peds/pedBrain';
import { loadAnimationDict } from '../../../../modules/utils';
import { SEQUENCE_PED, playSequence, sequenceProgress } from '../../../../modules/utils/sequence';
import { ANIM_POSE } from '../../anims';
import { GAS_ANIM, playWakeUp } from '../../gas';
import { paramsOf, type Performer, type Scratch } from './performer';

const REASSERT_MS = 5000;
const RETURN_TIMEOUT_MS = 20000;
/** Nearer his spot than this after a fight and he just picks the post back up. */
const HOME_REACH = 2.0;

/** The same looping clip, pinned to a position and a facing. */
const playAt = async (ped: number, at: NonNullable<IdleParams['animAt']>): Promise<boolean> => {
	if(IsEntityPlayingAnim(ped, at.dict, at.clip, 3)) {
		return true;
	}
	if(!await loadAnimationDict(at.dict) || !DoesEntityExist(ped)) {
		return false;
	}
	FreezeEntityPosition(ped, false);
	ClearPedTasksImmediately(ped);
	TaskPlayAnimAdvanced(ped, at.dict, at.clip, at.x, at.y, at.z, 0.0, 0.0, at.heading, 8.0, -8.0, -1, ANIM_POSE, 0.0, 0, 0);
	return true;
};

const playLoop = async (ped: number, anim: NonNullable<IdleParams['anim']>): Promise<boolean> => {
	if(IsEntityPlayingAnim(ped, anim.dict, anim.clip, 3)) {
		return true;
	}
	if(!await loadAnimationDict(anim.dict) || !DoesEntityExist(ped)) {
		return false;
	}
	ClearPedTasksImmediately(ped);
	TaskPlayAnim(ped, anim.dict, anim.clip, 8.0, -8.0, -1, ANIM_POSE, 0, false, false, false);
	return true;
};

const post = async (ped: number, idle: IdleParams): Promise<boolean> => {
	if(!DoesEntityExist(ped)) {
		return false;
	}
	if(idle.scenarioAt?.name) {
		const seat = idle.scenarioAt;

		FreezeEntityPosition(ped, false);
		if(!IsPedUsingScenario(ped, seat.name) && !IsPedActiveInScenario(ped)) {
			TaskStartScenarioAtPosition(ped, seat.name, seat.x, seat.y, seat.z, seat.heading, -1, true, true);
		}
		return true;
	}
	if(idle.animAt?.dict && idle.animAt.clip) {
		return playAt(ped, idle.animAt);
	}
	if(idle.anim?.dict && idle.anim.clip) {
		return playLoop(ped, idle.anim);
	}
	// Faced first: a ped spawned facing north stood with his back to his own counter.
	if(typeof idle.heading === 'number') {
		SetEntityHeading(ped, idle.heading);
	}
	if(idle.scenario) {
		// A frozen ped plays nothing.
		FreezeEntityPosition(ped, false);
		if(!IsPedUsingScenario(ped, idle.scenario) && !IsPedActiveInScenario(ped)) {
			TaskStartScenarioInPlace(ped, idle.scenario, 0, true);
		}
	}
	return true;
};

/** Back to the post: up off the floor first when `wake`, then the walk home, the facing, and the scenario, as one sequence. */
const wakeAndReturn = async (ped: number, idle: IdleParams, scratch: Scratch, wake = true): Promise<boolean> => {
	if(!DoesEntityExist(ped)) {
		return false;
	}
	if(wake && !(await loadAnimationDict(GAS_ANIM.dict))) {
		ClearPedTasks(ped);
		return post(ped, idle);
	}

	const upMs = wake ? Math.max(1000, Math.round(GetAnimDuration(GAS_ANIM.dict, GAS_ANIM.up) * 1000)) : 0;
	const home = idle.home;
	// Out of the car before anything else: a walk task on a seated ped plays where they sit.
	const seatedIn = IsPedInAnyVehicle(ped, false) ? GetVehiclePedIsIn(ped, false) : 0;

	FreezeEntityPosition(ped, false);

	const played = playSequence(ped, () => {
		if(seatedIn) {
			TaskLeaveVehicle(SEQUENCE_PED, seatedIn, 0);
		}
		if(wake) {
			TaskPlayAnim(SEQUENCE_PED, GAS_ANIM.dict, GAS_ANIM.up, 4.0, -4.0, upMs, 0, 0.0, false, false, false);
		}
		if(home) {
			TaskFollowNavMeshToCoord(SEQUENCE_PED, home.x, home.y, home.z, 1.0, 15000, 0.3, 0, home.heading);
			TaskAchieveHeading(SEQUENCE_PED, home.heading, 1500);
		}
		if(idle.scenario) {
			TaskStartScenarioInPlace(SEQUENCE_PED, idle.scenario, 0, true);
		}
	});

	if(!played) {
		if(!wake) {
			return post(ped, idle);
		}
		void playWakeUp(ped);
		return true;
	}

	const started = GetGameTimer();

	scratch.returningUntil = started + RETURN_TIMEOUT_MS;
	scratch.walked = true;
	// Standing on the spot ends the wait: the sequence finishes on a scenario, which never finishes.
	await new Promise<void>(resolve => {
		const poll = setInterval(() => {
			const [x, y, z] = DoesEntityExist(ped) ? GetEntityCoords(ped, false) : [0, 0, 0];
			const arrived = Boolean(home) && !IsPedInAnyVehicle(ped, false) && Vdist(x, y, z, home?.x ?? 0, home?.y ?? 0, home?.z ?? 0) <= HOME_REACH;

			if(!DoesEntityExist(ped) || arrived || sequenceProgress(ped) === -1 || GetGameTimer() - started > RETURN_TIMEOUT_MS) {
				clearInterval(poll);
				resolve();
			}
		}, 250);
	});
	scratch.returningUntil = 0;
	return true;
};

export const idle: Performer = {
	apply: async (ped, view, scratch, previous, now) => {
		const params = paramsOf<IdleParams>(view);

		scratch.nextAssert = now + REASSERT_MS;
		scratch.posted = false;
		scratch.walked = false;
		// A new post over an old one: out of the old scenario first, or the change never shows.
		if(previous === ACTIVITY.IDLE && params.scenario && IsPedActiveInScenario(ped) && !IsPedUsingScenario(ped, params.scenario)) {
			ClearPedTasks(ped);
		}
		if(previous === ACTIVITY.DOWN) {
			return wakeAndReturn(ped, params, scratch);
		}
		// Off his spot and on his feet after a fight: walked back to it, not the scenario started where he ended up.
		if(previous === ACTIVITY.FIGHT && params.home) {
			const [x, y, z] = GetEntityCoords(ped, false);

			if(IsPedInAnyVehicle(ped, false) || Vdist(x, y, z, params.home.x, params.home.y, params.home.z) > HOME_REACH) {
				return wakeAndReturn(ped, params, scratch, false);
			}
		}
		return post(ped, params);
	},
	tick: (ped, view, scratch, now) => {
		const params = paramsOf<IdleParams>(view);

		// Standing on the post at last, said once: the only honest answer to "has he got there yet".
		if(scratch.walked === true && !scratch.posted && params.home && !IsPedInAnyVehicle(ped, false)) {
			const [x, y, z] = GetEntityCoords(ped, false);

			if(Vdist(x, y, z, params.home.x, params.home.y, params.home.z) <= HOME_REACH) {
				scratch.posted = true;
				return 'posted';
			}
		}
		if(now < Number(scratch.nextAssert ?? 0) || now < Number(scratch.returningUntil ?? 0)) {
			return null;
		}
		scratch.nextAssert = now + REASSERT_MS;
		if(params.scenarioAt?.name || params.scenario) {
			void post(ped, params);
		}
		return null;
	},
};

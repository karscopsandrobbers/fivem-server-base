/* What a ped looks like knocked down and coming round: one clip going down, one getting up. */
import { loadAnimationDict } from '../../modules/utils';

export const GAS_ANIM = Object.freeze({
	dict: 'safe@trevor@ig_8',
	down: 'ig_8_huff_gas_player',
	up: 'ig_8_wake_up_front_player',
});

/** Hold the last frame: the clip falls and stays down. */
const HOLD_FLAGS = 2;

const down = (ped: number): void => {
	// Deaf to the world while down; the wake-up releases it.
	SetBlockingOfNonTemporaryEvents(ped, true);
	SetPedKeepTask(ped, true);
	ClearPedTasksImmediately(ped);
	TaskPlayAnim(ped, GAS_ANIM.dict, GAS_ANIM.down, 4.0, -4.0, -1, HOLD_FLAGS, 0.0, false, false, false);
};

export const playGassed = async (ped: number): Promise<void> => {
	if(!(await loadAnimationDict(GAS_ANIM.dict)) || !DoesEntityExist(ped)) {
		return;
	}
	down(ped);
	// A scenario or a combat task can win the same frame; a second later he is put down again.
	setTimeout(() => {
		if(DoesEntityExist(ped) && !IsEntityDead(ped) && NetworkHasControlOfEntity(ped) && !IsEntityPlayingAnim(ped, GAS_ANIM.dict, GAS_ANIM.down, 3)) {
			down(ped);
		}
	}, 1000);
};

export const playWakeUp = async (ped: number, release = false): Promise<void> => {
	if(!DoesEntityExist(ped)) {
		return;
	}
	if(release) {
		SetBlockingOfNonTemporaryEvents(ped, false);
		SetPedKeepTask(ped, false);
	}
	if(!(await loadAnimationDict(GAS_ANIM.dict))) {
		ClearPedTasks(ped);
		return;
	}
	TaskPlayAnim(ped, GAS_ANIM.dict, GAS_ANIM.up, 4.0, -4.0, -1, 0, 0.0, false, false, false);
};

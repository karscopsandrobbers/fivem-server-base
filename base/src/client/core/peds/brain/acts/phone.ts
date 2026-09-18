/*
 * On the phone to the police. The clock is the server's: the act ends when the activity's time
 * runs out. This client says only when it was stopped (shoved, shot, put on the floor), and
 * keeps the phone in the hand for as long as it lasts.
 */
import { CALL_CLIP, CALL_DICT, CALL_LINES, CALL_LINE_EVERY_MS, say, voiceFor } from '../../callVoice';
import type { Performer } from './performer';

interface PhoneScratch {
	voice?: string;
	line?: number;
	nextLineAt?: number;
	stopped?: boolean;
}

export const phone: Performer = {
	started: 'dialling',
	apply: (ped, _view, scratch, _previous, now) => {
		const call = scratch as PhoneScratch;

		if(!HasAnimDictLoaded(CALL_DICT)) {
			RequestAnimDict(CALL_DICT);
			return false;
		}
		SetBlockingOfNonTemporaryEvents(ped, true);
		ClearPedTasksImmediately(ped);
		ClearEntityLastDamageEntity(ped);
		TaskPlayAnim(ped, CALL_DICT, CALL_CLIP, 4.0, -4.0, -1, 49, 0.0, false, false, false);
		call.voice ??= voiceFor(ped);
		say(ped, call.voice, CALL_LINES[0], 'SPEECH_PARAMS_FORCE_NORMAL_CLEAR');
		call.line = 1;
		call.nextLineAt = now + CALL_LINE_EVERY_MS;
		call.stopped = false;
		return true;
	},
	tick: (ped, view, scratch, now, unix) => {
		const call = scratch as PhoneScratch;

		if(call.stopped || (view.until > 0 && unix >= view.until)) {
			return null;
		}
		if(IsPedRagdoll(ped) || HasEntityBeenDamagedByAnyPed(ped)) {
			call.stopped = true;
			ClearPedTasks(ped);
			TaskCower(ped, -1);
			return 'stopped';
		}
		if(!IsEntityPlayingAnim(ped, CALL_DICT, CALL_CLIP, 3)) {
			TaskPlayAnim(ped, CALL_DICT, CALL_CLIP, 4.0, -4.0, -1, 49, 0.0, false, false, false);
		}
		if(now >= (call.nextLineAt ?? 0)) {
			const line = call.line ?? 1;

			say(ped, call.voice ?? voiceFor(ped), CALL_LINES[1 + ((line - 1) % (CALL_LINES.length - 1))]);
			call.line = line + 1;
			call.nextLineAt = now + CALL_LINE_EVERY_MS;
		}
		return null;
	},
	clear: ped => {
		ClearPedTasks(ped);
	},
};

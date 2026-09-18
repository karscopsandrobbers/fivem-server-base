/* The police call as a ped says it: the animation, the lines, and the voice per model. */
import { POLICE_CALL_FALLBACK_VOICES, POLICE_CALL_VOICES } from '@shared/peds/pedVoices';

export const
	CALL_DICT = 'cellphone@',
	CALL_CLIP = 'cellphone_call_listen_base',
	/** The first is the reaction to what they saw, then the call itself, with a threat now and then. */
	CALL_LINES = ['CALL_COPS_COMMIT', 'PHONE_CALL_COPS', 'PHONE_CALL_COPS', 'CALL_COPS_THREAT'],
	CALL_LINE_EVERY_MS = 3000,
	SPEECH_CHECK_MS = 400
;

const voicesByModel = new Map<number, readonly string[]>();

for(const [model, voices] of Object.entries(POLICE_CALL_VOICES)) {
	voicesByModel.set(GetHashKey(model) >>> 0, voices);
}

const fallbackVoice = (ped: number): string => (IsPedMale(ped) ? POLICE_CALL_FALLBACK_VOICES.male : POLICE_CALL_FALLBACK_VOICES.female);

/** The voice this ped makes the call in: one of its model's, or a stand-in of its gender. */
export const voiceFor = (ped: number): string => {
	const own = voicesByModel.get(GetEntityModel(ped) >>> 0);

	return own?.length ? own[Math.floor(Math.random() * own.length)] : fallbackVoice(ped);
};

/** Say a line in the caller's voice; a line the voice lacks is said by the gender stand-in. */
export const say = (ped: number, voice: string, context: string, params = 'SPEECH_PARAMS_FORCE_NORMAL'): void => {
	PlayPedAmbientSpeechWithVoiceNative(ped, context, voice, params, false);
	setTimeout(() => {
		if(DoesEntityExist(ped) && !IsAmbientSpeechPlaying(ped)) {
			PlayPedAmbientSpeechWithVoiceNative(ped, context, fallbackVoice(ped), params, false);
		}
	}, SPEECH_CHECK_MS);
};

/*
 * GTA's own notification feed (top left) and the help text (bottom centre), and the server events
 * that reach them. Both take `~r~`-style colour codes.
 */
import { EVENTS } from '@shared/events';
import { addTextComponents } from './index';
import { localPlayer } from '../core/player/nativeHooks';

export const notify = (message: string, flashing = false): void => {
	BeginTextCommandThefeedPost('THREESTRINGS');
	addTextComponents(message);
	EndTextCommandThefeedPostTicker(flashing, true);
	localPlayer.playSoundFrontEnd('Text_Arrive_Tone', 'Phone_SoundSet_Default');
};

/** The richer notification with a character portrait: `CHAR_DEFAULT`, `CHAR_LESTER`, ... */
export const notifyWithPicture = (title: string, subtitle: string, message: string, picture = 'CHAR_DEFAULT', icon = 0): void => {
	BeginTextCommandThefeedPost('THREESTRINGS');
	addTextComponents(message);
	EndTextCommandThefeedPostMessagetext(picture, picture, false, icon, title, subtitle);
	EndTextCommandThefeedPostTicker(false, true);
};

/** The bottom-centre help prompt ("Press ~INPUT_CONTEXT~ to ..."). Stays until cleared. */
export const displayHelp = (text: string): void => {
	BeginTextCommandDisplayHelp('THREESTRINGS');
	addTextComponents(text);
	EndTextCommandDisplayHelp(0, false, true, -1);
};

export const clearHelp = (): void => {
	ClearAllHelpMessages();
};

onNet(EVENTS.NOTIFY, (message: unknown, flashing = false) => {
	if(typeof message === 'string') {
		notify(message, Boolean(flashing));
	}
});

onNet(EVENTS.DISPLAY_HELP, (text: unknown) => {
	if(typeof text === 'string') {
		displayHelp(text);
	}
});

onNet(EVENTS.SOUND_FRONTEND, (audioName: unknown, audioRef: unknown) => {
	if(typeof audioName === 'string' && typeof audioRef === 'string') {
		localPlayer.playSoundFrontEnd(audioName, audioRef);
	}
});

/*
 * What a prompt's cap prints, and which GTA control fires it. Say either and the other is worked
 * out. The letter for a control comes from the GAME first: a player who moved E to F reads F.
 */
import { controls } from '../../modules/constants';
import { getControlName } from '../../modules/utils';

/** The default binding of each, for when the game will not say what the current one is (a pad). */
export const PROMPT_KEYS = Object.freeze({
	E: controls.INPUT_PICKUP,
	F: controls.INPUT_ENTER,
	G: controls.INPUT_DETONATE,
	H: controls.INPUT_VEH_HEADLIGHT,
	Q: controls.INPUT_COVER,
	R: controls.INPUT_RELOAD,
	X: controls.INPUT_VEH_DUCK,
	Y: controls.INPUT_MP_TEXT_CHAT_TEAM,
	Z: controls.INPUT_MULTIPLAYER_INFO,
});

export type PromptKey = keyof typeof PROMPT_KEYS;

const BY_CONTROL = new Map<number, PromptKey>(
	(Object.entries(PROMPT_KEYS) as Array<[PromptKey, number]>).map(([key, control]) => [control, key]),
);

export const keyForControl = (control: number): PromptKey | null => BY_CONTROL.get(control) ?? null;

export interface KeySpec {
	control?: number;
	key?: PromptKey;
	keyLabel?: string;
	drawOnly?: boolean;
}

/** What the game says a control is bound to right now, or null when that is not printable (a pad glyph id). */
const liveKeyLabel = (control: number): string | null => {
	const name = getControlName(control).trim().toUpperCase();

	return name && name.length <= 5 && !/^\d+$/.test(name) ? name : null;
};

/** Settle a prompt's key: what fires it, and what the cap prints. A drawn-only prompt resolves to control 0. */
export const resolveKey = (spec: KeySpec, describe: string): { control: number; label: string } => {
	const control = typeof spec.control === 'number' ? spec.control : (spec.key ? PROMPT_KEYS[spec.key] : 0);

	if(!control && !spec.key) {
		console.log(`[prompts]: '${describe}' names neither a key nor a control.`);
		return { control: 0, label: '?' };
	}
	if(spec.drawOnly) {
		return { control: 0, label: spec.keyLabel ?? spec.key ?? keyForControl(control) ?? '?' };
	}
	return { control, label: spec.keyLabel ?? liveKeyLabel(control) ?? keyForControl(control) ?? spec.key ?? '?' };
};

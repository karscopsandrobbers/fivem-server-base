/* GTA's animation flags, which are a bitfield rather than an enum. */
export const ANIM_FLAG = {
	LOOP: 1,
	HOLD_LAST_FRAME: 2,
	NOT_INTERRUPTABLE: 8,
	UPPERBODY: 16,
	SECONDARY: 32,
} as const;

/** Hold a stance until something clears it. */
export const ANIM_POSE = ANIM_FLAG.LOOP | ANIM_FLAG.NOT_INTERRUPTABLE;

/** Play once, over the top of whatever the ped is already doing. */
export const ANIM_REACTION = ANIM_FLAG.UPPERBODY | ANIM_FLAG.SECONDARY;

export { takeControl } from '../../modules/utils';

/*
 * What a floating prompt is, and what a thing that offers one looks like.
 *
 * A **definition** is declarative: it says what it looks for and the one shared scan finds it.
 * `createPrompt` is imperative, for a module already scanning for its own reasons that only
 * wants the drawing and the key handling. Both end up in the same registry and the same frame.
 */
import type { PromptKey } from './keys';

/** Where the player has to be for a prompt to count. */
export const PROMPT_STATE = Object.freeze({
	ON_FOOT: 'onfoot',
	VEHICLE: 'vehicle',
});

export type PromptState = typeof PROMPT_STATE[keyof typeof PROMPT_STATE];

export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

/** One thing in the world a definition found, this scan. */
export interface PromptTarget {
	/** Stable for as long as it is the same thing, or the prompt is rebuilt and flickers every scan. */
	key: string;
	entity?: number;
	bone?: string;
	coords?: Vec3;
	offset?: Vec3;
	label?: string;
	drawDistance?: number;
	interactDistance?: number;
	/** Handed back to onInteract, so a definition need not look the thing up twice. */
	data?: unknown;
}

export interface PromptOptions {
	/**
	 * What fires it, said ONE of two ways. `control` is the one to reach for: a GTA control is
	 * bound on a pad as well, and the cap's letter comes from what it is bound to right now. `key`
	 * names the letter instead, which is all a drawn-only prompt can do.
	 */
	control?: number;
	key?: PromptKey;
	/** Override the letter. Rarely wanted. */
	keyLabel?: string;
	/** Draw the cap but never answer it: a key mapping elsewhere owns the press. */
	drawOnly?: boolean;
	/** Words with no key and no cap: what would be needed, or why not. */
	info?: boolean;
	label: string;
	/** One of these anchors it. An entity is followed; a bone is followed on that entity. */
	coords?: Vec3;
	entity?: number;
	bone?: string;
	offset?: Vec3;
	drawDistance?: number;
	interactDistance?: number;
	canDraw?: () => boolean;
	canInteract?: () => boolean;
	onInteract?: (distance: number) => void;
	onEnter?: () => void;
	onExit?: () => void;
	/** Which row of a stack this is: rows sit under each other, 0 on top. */
	row?: number;
	/** Where the player must be. Unset is on foot only. */
	states?: readonly PromptState[];
}

/** A kind of thing that offers a prompt, found by the one shared scan. */
export interface PromptDefinition {
	/** Stable name, for /prompts and the debug channel. */
	id: string;
	disabled?: boolean;
	control?: number;
	key?: PromptKey;
	keyLabel?: string;
	drawOnly?: boolean;
	/** The words, or a function of the target. Unused when the definition has rows. */
	label?: string | ((target: PromptTarget) => string);
	drawDistance?: number;
	interactDistance?: number;
	states?: readonly PromptState[];
	/** How often this one is looked for, for a search dearer than the rest. */
	scanMs?: number;
	/** Everything of this kind near the player, right now. Called on the shared scan. */
	find: () => PromptTarget[];
	/** Several verbs on one target, stacked in this order; each row names its own key and action. */
	rows?: (target: PromptTarget) => PromptRow[];
	canDraw?: (target: PromptTarget) => boolean;
	canInteract?: (target: PromptTarget) => boolean;
	onInteract?: (target: PromptTarget, distance: number) => void;
	onEnter?: (target: PromptTarget) => void;
	onExit?: (target: PromptTarget) => void;
}

/** One verb in a definition's stack. */
export interface PromptRow {
	id: string;
	control?: number;
	key?: PromptKey;
	keyLabel?: string;
	drawOnly?: boolean;
	info?: boolean;
	label: string;
	canInteract?: () => boolean;
	onInteract?: (distance: number) => void;
}

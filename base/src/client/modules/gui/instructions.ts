/*
 * The INSTRUCTIONAL_BUTTONS bar: key glyphs with labels in the bottom-right corner.
 *
 *   const bar = new InstructionalButtons();
 *   bar.addButton('Interact', controls.INPUT_CONTEXT);
 *   bar.toggle(true);   // on: drawn every frame until toggle(false) or dispose()
 *
 * Every bar shares ONE movie that is never given back: the bar switched on last is the one drawn,
 * and the one under it comes back after. The bar is rebuilt on the first loaded frame after any
 * change; pushing slots at a movie still streaming is how a bar comes up blank.
 */
import { Scaleform } from '../../gui/scaleform';

const MOVIE = 'INSTRUCTIONAL_BUTTONS';
const RELOAD_AFTER_MS = 1000;

interface Button {
	control: string;
	title: string;
}

const hud = new Scaleform(MOVIE);

/** Bars switched on, oldest first. The last is the one on screen. */
const shown: InstructionalButtons[] = [];

let built: InstructionalButtons | null = null;
let render: number | null = null;
let unloadedSince = 0;

const glyphOf = (control: number | string): string => (
	typeof control === 'number' ? GetControlInstructionalButton(2, control, true) : `t_${control}`
);

class InstructionalButtons {
	private state = false;
	private dirty = false;
	private buttons: Button[] = [];
	private readonly backgroundColour: [number, number, number, number] = [0, 0, 0, 80];

	setBackgroundColour(r: number, g: number, b: number, a = 80): void {
		this.backgroundColour[0] = r;
		this.backgroundColour[1] = g;
		this.backgroundColour[2] = b;
		this.backgroundColour[3] = a;
		this.dirty = true;
	}

	/** `control` is an INPUT_* id, or a letter for a key that is not a GTA control. */
	addButton(title: string, control: number | string): void {
		this.buttons.push({ control: glyphOf(control), title });
		this.dirty = true;
	}

	changeButtonTitle(control: number | string, title: string): void {
		const glyph = glyphOf(control);

		for(const button of this.buttons) {
			if(button.control === glyph) {
				button.title = title;
			}
		}
		this.dirty = true;
	}

	removeButton(control: number | string): void {
		const glyph = glyphOf(control);

		this.buttons = this.buttons.filter(button => button.control !== glyph);
		this.dirty = true;
	}

	removeButtons(): void {
		this.buttons = [];
		this.dirty = true;
	}

	/** On puts this bar on top of any other showing; off brings back the one under it. */
	toggle(state: boolean): void {
		const index = shown.indexOf(this);

		if(index !== -1) {
			shown.splice(index, 1);
		}
		this.state = state;
		if(state) {
			shown.push(this);
			this.dirty = true;
			render ??= setTick(InstructionalButtons.drawTop);
		} else if(!shown.length && render !== null) {
			clearTick(render);
			render = null;
		}
	}

	isActive(): boolean {
		return this.state;
	}

	dispose(): void {
		this.toggle(false);
	}

	private static drawTop(): void {
		const top = shown[shown.length - 1];

		if(!top || !ensureLoaded()) {
			return;
		}
		if(built !== top || top.dirty) {
			top.rebuild();
		}
		hud.renderFullscreen();
	}

	private rebuild(): void {
		hud.callFunction('CLEAR_ALL');
		hud.callFunction('TOGGLE_MOUSE_BUTTONS', false);
		hud.callFunction('CREATE_CONTAINER');
		hud.callFunction('SET_CLEAR_SPACE', 200);
		this.buttons.forEach((button, slot) => {
			hud.callFunction('SET_DATA_SLOT', slot, button.control, button.title);
		});
		hud.callFunction('SET_BACKGROUND_COLOUR', ...this.backgroundColour);
		hud.callFunction('DRAW_INSTRUCTIONAL_BUTTONS', -1);
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		built = this;
		this.dirty = false;
	}
}

/** The movie is up. One that has been gone a moment is asked for again, and rebuilt when it returns. */
const ensureLoaded = (): boolean => {
	if(hud.loaded) {
		unloadedSince = 0;
		return true;
	}

	const now = GetGameTimer();

	built = null;
	unloadedSince ||= now;
	if(now - unloadedSince > RELOAD_AFTER_MS) {
		hud.reload();
		unloadedSince = now;
	}
	return false;
};

export default InstructionalButtons;

/*
 * Key bindings. FiveM has no raw-keyboard binding, so key actions ride RegisterKeyMapping and the
 * player can rebind them in Settings > Key Bindings > FiveM. GTA controls (E, G, ...) cannot be
 * remapped per resource, so `bindControl` polls IsControlJustPressed in one shared tick.
 */
interface KeyAction {
	onDown?: () => void;
	onUp?: () => void;
}

interface ControlAction {
	control: number;
	onDown?: () => void;
	onUp?: () => void;
}

const keyActions = new Map<string, KeyAction>();
const controlActions: ControlAction[] = [];

/** Whether a keypress is text right now rather than a command: a NUI page holds the keyboard. */
const keysAreText = (): boolean => IsNuiFocused() && !IsNuiFocusKeepingInput();

/**
 * Register a keyboard action the player can rebind.
 * @param action      unique id, used for the +/- command pair
 * @param description shown in Settings > Key Bindings
 * @param defaultKey  e.g. 'F5', 'NUMPAD4', 'N'
 */
export const bindKey = (action: string, description: string, defaultKey: string, onDown?: () => void, onUp?: () => void): void => {
	keyActions.set(action, { onDown, onUp });
	RegisterCommand(`+base:${action}`, () => {
		if(!keysAreText()) {
			keyActions.get(action)?.onDown?.();
		}
	}, false);
	RegisterCommand(`-base:${action}`, () => {
		if(!keysAreText()) {
			keyActions.get(action)?.onUp?.();
		}
	}, false);
	RegisterKeyMapping(`+base:${action}`, description, 'keyboard', defaultKey);
};

/** A GTA control as an action: `control` is the INPUT_* id (51 for E). */
export const bindControl = (control: number, onDown?: () => void, onUp?: () => void): void => {
	controlActions.push({ control, onDown, onUp });
};

setTick(() => {
	if(!controlActions.length || IsPauseMenuActive()) {
		return;
	}
	for(const action of controlActions) {
		if(action.onDown && IsControlJustPressed(0, action.control)) {
			action.onDown();
		}
		if(action.onUp && IsControlJustReleased(0, action.control)) {
			action.onUp();
		}
	}
});

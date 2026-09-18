/*
 * Prompts that float in the world: one registry, one scan, one frame.
 *
 * A prompt is a thing in the world worth walking to. Far off it is a dot inside a ring; close
 * enough to use it opens into a key cap and a label. Several on one anchor stack into a list.
 * Every definition is searched on one shared beat and drawn in one frame loop; a definition says
 * what it looks for and what to do on the key, and nothing else.
 */
import { Delay, localPlayer } from '../player/nativeHooks';
import { PROMPT_STATE, PromptDefinition, PromptOptions, PromptRow, PromptState, PromptTarget, Vec3 } from './types';
import { STYLE, drawDot, drawRingShape, drawSlanted, drawText, promptFont, textWidth } from './style';
import { resolveKey } from './keys';

export { PROMPT_STATE } from './types';
export { PROMPT_KEYS } from './keys';
export type { PromptKey } from './keys';
export type { PromptDefinition, PromptOptions, PromptRow, PromptState, PromptTarget } from './types';

/** How often the definitions are asked what is nearby. */
const SCAN_MS = 250;

/** E answers on both of these. */
const E_CONTROLS: ReadonlySet<number> = new Set([38, 51]);

const scaleFor = (distance: number): number => {
	const t = Math.min(1, Math.max(0, distance / STYLE.scaleFarAt));

	return STYLE.scaleNear + (STYLE.scaleFar - STYLE.scaleNear) * t;
};

const inState = (states: readonly PromptState[] | undefined): boolean => {
	const inVehicle = IsPedInAnyVehicle(PlayerPedId(), false);

	if(!states?.length) {
		return !inVehicle;
	}
	return (states.includes(PROMPT_STATE.ON_FOOT) && !inVehicle) || (states.includes(PROMPT_STATE.VEHICLE) && inVehicle);
};

export class Prompt {
	readonly options: Required<Pick<PromptOptions, 'drawDistance' | 'interactDistance' | 'row'>> & PromptOptions;
	private boneIndex = -1;
	private at: Vec3 = { x: 0, y: 0, z: 0 };
	private visible = false;
	private inReach = false;
	/** How far off it is while in reach and answering a key; Infinity otherwise. */
	reachDistance = Infinity;
	/** 0 is the dot, 1 is the cap and the label fully out. */
	private open = 0;
	private readonly control: number;
	private keyLabel: string;
	private keyWidth = 0;
	private textHeight = 0;
	private keyHeight = 0;
	private aspect = 1;
	private flash: { size: number; a: number } | null = null;
	private destroyed = false;

	constructor(options: PromptOptions) {
		this.options = {
			...options,
			drawDistance: options.drawDistance ?? STYLE.drawDistance,
			interactDistance: options.interactDistance ?? STYLE.interactDistance,
			row: options.row ?? 0,
		};

		const binding = options.info ? { control: 0, label: '' } : resolveKey(options, options.label);

		this.control = binding.control;
		this.keyLabel = binding.label;
		if(options.entity && options.bone) {
			this.boneIndex = GetEntityBoneIndexByName(options.entity, options.bone);
		}
		this.measure();
		prompts.add(this);
	}

	setLabel(label: string): void {
		if(label !== this.options.label) {
			this.options.label = label;
			this.measure();
		}
	}

	/** Pick the binding up again, in case the player has moved it. */
	refreshKey(): void {
		if(this.options.info) {
			return;
		}

		const label = resolveKey(this.options, this.options.label).label;

		if(label !== this.keyLabel) {
			this.keyLabel = label;
			this.measure();
		}
	}

	destroy(): void {
		this.destroyed = true;
		prompts.delete(this);
	}

	/** The cap's size at this scale: big enough for the letter, with the padding round it. */
	private capSize(k: number): { w: number; h: number } {
		return {
			w: Math.max(STYLE.capSize, this.keyWidth + STYLE.padding * 2) * k,
			h: Math.max(STYLE.capSize * this.aspect, this.keyHeight * STYLE.keyGlyphHeight + STYLE.padding * this.aspect * 2) * k,
		};
	}

	private static textTop(centre: number, height: number, k: number): number {
		return centre - height * k * STYLE.textCentre;
	}

	measure(): void {
		const [sw, sh] = GetActiveScreenResolution();

		this.aspect = sw / sh;
		this.keyWidth = textWidth(this.keyLabel, STYLE.keyScale, promptFont('key'));
		this.textHeight = GetRenderedCharacterHeight(STYLE.scale, promptFont('label'));
		this.keyHeight = GetRenderedCharacterHeight(STYLE.keyScale, promptFont('key'));
	}

	private locate(): boolean {
		const { entity, bone, coords, offset } = this.options;
		let base: Vec3 | null = null;

		if(entity) {
			if(!DoesEntityExist(entity)) {
				return false;
			}

			const [x, y, z] = bone && this.boneIndex >= 0 ? GetWorldPositionOfEntityBone(entity, this.boneIndex) : GetEntityCoords(entity, false);

			base = { x, y, z };
		} else if(coords) {
			base = coords;
		}
		if(!base) {
			return false;
		}
		this.at = { x: base.x + (offset?.x ?? 0), y: base.y + (offset?.y ?? 0), z: base.z + (offset?.z ?? 0) };
		return true;
	}

	/** One frame of this prompt. The distance when its key was just pressed in reach, else -1. */
	update(px: number, py: number, pz: number, now: number): number {
		if(this.destroyed || !this.locate() || !inState(this.options.states)) {
			this.hide();
			return -1;
		}

		const distance = Vdist(px, py, pz, this.at.x, this.at.y, this.at.z);

		if(distance >= this.options.drawDistance || this.options.canDraw?.() === false) {
			this.hide();
			return -1;
		}
		this.visible = true;

		const near = distance < this.options.interactDistance;
		const answering = near && this.control > 0 && this.options.canInteract?.() !== false;

		this.reachDistance = answering ? distance : Infinity;
		if(near && !this.inReach) {
			this.inReach = true;
			this.options.onEnter?.();
		} else if(!near && this.inReach) {
			this.inReach = false;
			this.options.onExit?.();
		}
		this.draw(near, distance, now);
		return answering && IsControlJustPressed(0, this.control) ? distance : -1;
	}

	get answers(): number {
		return this.control;
	}

	get words(): string {
		return this.options.label;
	}

	press(distance: number): void {
		this.flash = { size: 1, a: 210 };
		if(this.options.canInteract?.() !== false) {
			this.options.onInteract?.(distance);
		}
	}

	private hide(): void {
		this.reachDistance = Infinity;
		if(this.inReach) {
			this.inReach = false;
			this.options.onExit?.();
		}
		this.visible = false;
		this.open = 0;
		this.flash = null;
	}

	private draw(near: boolean, distance: number, now: number): void {
		const k = scaleFor(distance);

		this.open = near ? Math.min(1, this.open + STYLE.open) : Math.max(0, this.open - STYLE.open);

		const rowY = this.options.row * (this.capSize(k).h + STYLE.rowGap * this.aspect * k);

		SetDrawOrigin(this.at.x, this.at.y, this.at.z, 0);
		if(this.open < 1) {
			this.drawClosed(k, rowY, now);
		}
		if(this.open > 0) {
			this.drawOpen(k, rowY);
		}
		ClearDrawOrigin();
	}

	private drawClosed(k: number, rowY: number, now: number): void {
		const alpha = 1 - Math.min(1, this.open * 2);

		if(alpha <= 0) {
			return;
		}

		const wave = Math.sin(now * STYLE.pulseSpeed);
		const breath = 1 + wave * STYLE.pulse;
		const ringAlpha = alpha * (1 - STYLE.pulseAlpha * (1 - (wave + 1) / 2));

		drawRingShape(0, rowY, STYLE.ringSize * k * breath, Math.max(STYLE.ringLineMin, STYLE.ringLine * k), this.aspect, STYLE.ring, ringAlpha);
		drawDot(0, rowY, STYLE.dotSize * k, this.aspect, STYLE.dot, alpha);
	}

	private drawOpen(k: number, rowY: number): void {
		if(this.options.info) {
			this.drawInfo(k, rowY);
			return;
		}

		const capW = this.capSize(k).w;
		const slantBy = capW * STYLE.slant;
		const t = 1 - Math.pow(1 - this.open, 3);
		const labelX = capW / 2 + slantBy / 2 + STYLE.margin * k;

		this.drawCap(0, rowY, k, t);
		if(t > 0.25) {
			const alpha = Math.round(STYLE.labelColour[3] * Math.min(1, (t - 0.25) / 0.6));

			drawText(this.options.label, labelX, Prompt.textTop(rowY, this.textHeight, k), STYLE.scale * k, promptFont('label'), [STYLE.labelColour[0], STYLE.labelColour[1], STYLE.labelColour[2], alpha], false, true);
		}
	}

	private drawCap(x: number, y: number, k: number, alpha: number): void {
		const { w: capW, h: capH } = this.capSize(k);
		const slantBy = capW * STYLE.slant;
		const capY = y + STYLE.capNudge * this.aspect * k;

		drawSlanted(x, capY, capW, capH, slantBy, STYLE.cap, alpha);
		drawText(this.keyLabel, x, Prompt.textTop(y, this.keyHeight, k), STYLE.keyScale * k, promptFont('key'), [STYLE.keyColour[0], STYLE.keyColour[1], STYLE.keyColour[2], Math.round(255 * alpha)], true, false);

		if(this.flash) {
			this.flash.size += 0.06;
			this.flash.a -= 18;
			drawSlanted(x, capY, capW * this.flash.size, capH * this.flash.size, slantBy, [STYLE.cap[0], STYLE.cap[1], STYLE.cap[2], Math.max(0, this.flash.a)], alpha);
			if(this.flash.a <= 0) {
				this.flash = null;
			}
		}
	}

	private drawInfo(k: number, rowY: number): void {
		const t = 1 - Math.pow(1 - this.open, 3);
		const capW = STYLE.capSize * k;
		const labelX = capW / 2 + (capW * STYLE.slant) / 2 + STYLE.margin * k;
		const alpha = Math.round(STYLE.labelColour[3] * t);

		drawDot(0, rowY, STYLE.dotSize * k, this.aspect, STYLE.dot, t);
		drawText(this.options.label, labelX, Prompt.textTop(rowY, this.textHeight, k), STYLE.scale * k, promptFont('label'), [STYLE.labelColour[0], STYLE.labelColour[1], STYLE.labelColour[2], alpha], false, true);
	}
}

const prompts = new Set<Prompt>();

export const createPrompt = (options: PromptOptions): Prompt => new Prompt(options);

/** Several verbs on one anchor, stacked. Put the likeliest first. */
export const createPromptGroup = (
	anchor: Pick<PromptOptions, 'coords' | 'entity' | 'bone' | 'offset' | 'drawDistance' | 'interactDistance' | 'canDraw' | 'states'>,
	rows: Array<Omit<PromptOptions, 'coords' | 'entity' | 'bone' | 'offset' | 'row'>>,
): Prompt[] => rows.map((row, index) => new Prompt({ ...anchor, ...row, row: index }));

// ── the registry ───────────────────────────────────────────────────────────

interface Live {
	target: PromptTarget;
	prompts: Prompt[];
	rows: PromptRow[] | null;
	signature: string;
}

interface Registered {
	definition: PromptDefinition;
	live: Map<string, Live>;
	nextScan: number;
}

const registry = new Map<string, Registered>();

/** Add a kind of thing that offers a prompt. Registered once, at import. */
export const definePrompt = (definition: PromptDefinition): void => {
	if(registry.has(definition.id)) {
		console.log(`[prompts]: '${definition.id}' is defined twice; the second is ignored.`);
		return;
	}
	registry.set(definition.id, { definition, live: new Map(), nextScan: 0 });
};

const clear = (entry: Registered): void => {
	for(const live of entry.live.values()) {
		for(const prompt of live.prompts) {
			prompt.destroy();
		}
	}
	entry.live.clear();
};

export const setPromptEnabled = (id: string, enabled: boolean): boolean => {
	const entry = registry.get(id);

	if(!entry) {
		return false;
	}
	entry.definition.disabled = !enabled;
	if(!enabled) {
		clear(entry);
	}
	return true;
};

export const describePrompts = (): string[] => [...registry.values()].map(entry => (
	`${entry.definition.id}: ${entry.definition.disabled ? 'off' : 'on'}, ${entry.live.size} showing`
));

const labelFor = (definition: PromptDefinition, target: PromptTarget): string => (
	target.label ?? (typeof definition.label === 'function' ? definition.label(target) : definition.label ?? '')
);

const signatureOf = (rows: PromptRow[] | null): string => (
	rows ? rows.map(row => `${row.id}:${row.control ?? row.key ?? ''}:${row.info ? 'i' : ''}${row.drawOnly ? 'd' : ''}`).join('|') : ''
);

const build = (definition: PromptDefinition, live: Live): Prompt[] => {
	const { target } = live;
	const anchor: PromptOptions = {
		label: '',
		entity: target.entity,
		bone: target.bone,
		coords: target.coords,
		offset: target.offset,
		drawDistance: target.drawDistance ?? definition.drawDistance,
		interactDistance: target.interactDistance ?? definition.interactDistance,
		states: definition.states,
		canDraw: () => definition.canDraw?.(live.target) !== false,
	};

	if(!live.rows) {
		return [createPrompt({
			...anchor,
			control: definition.control,
			key: definition.key,
			keyLabel: definition.keyLabel,
			drawOnly: definition.drawOnly,
			label: labelFor(definition, target),
			canInteract: () => definition.canInteract?.(live.target) !== false,
			onInteract: distance => definition.onInteract?.(live.target, distance),
			onEnter: () => definition.onEnter?.(live.target),
			onExit: () => definition.onExit?.(live.target),
		})];
	}

	const current = (id: string): PromptRow | undefined => live.rows?.find(row => row.id === id);

	return live.rows.map((row, index) => createPrompt({
		...anchor,
		control: row.control,
		key: row.key,
		keyLabel: row.keyLabel,
		drawOnly: row.drawOnly,
		info: row.info,
		label: row.label,
		row: index,
		canInteract: () => definition.canInteract?.(live.target) !== false && current(row.id)?.canInteract?.() !== false,
		onInteract: distance => current(row.id)?.onInteract?.(distance),
		onEnter: index === 0 ? () => definition.onEnter?.(live.target) : undefined,
		onExit: index === 0 ? () => definition.onExit?.(live.target) : undefined,
	}));
};

/** One pass of one definition. Matched by key rather than rebuilt, so a prompt on screen keeps its animation. */
const scan = (entry: Registered): void => {
	const found = entry.definition.disabled ? [] : entry.definition.find();
	const seen = new Set<string>();

	for(const target of found) {
		seen.add(target.key);

		const rows = entry.definition.rows?.(target) ?? null;
		const signature = signatureOf(rows);
		const existing = entry.live.get(target.key);

		if(existing && existing.signature === signature) {
			existing.target = target;
			existing.rows = rows;
			existing.prompts.forEach((prompt, index) => prompt.setLabel(rows ? rows[index].label : labelFor(entry.definition, target)));
			continue;
		}
		for(const prompt of existing?.prompts ?? []) {
			prompt.destroy();
		}

		const live: Live = { target, prompts: [], rows, signature };

		live.prompts = build(entry.definition, live);
		entry.live.set(target.key, live);
	}
	for(const [key, live] of entry.live) {
		if(!seen.has(key)) {
			for(const prompt of live.prompts) {
				prompt.destroy();
			}
			entry.live.delete(key);
		}
	}
};

const describeError = (error: unknown): string => (error instanceof Error ? (error.stack ?? error.message) : String(error));

/** A definition that throws is switched off, so it cannot take every other prompt down with it. */
const scanSafely = (entry: Registered): void => {
	try {
		scan(entry);
	} catch(error) {
		entry.definition.disabled = true;
		clear(entry);
		console.log(`[prompts]: '${entry.definition.id}' threw while scanning and is now off. ${describeError(error)}`);
	}
};

void (async (): Promise<void> => {
	for(;;) {
		await Delay(SCAN_MS);

		const spawned = localPlayer.isSpawned();
		const now = GetGameTimer();

		for(const entry of registry.values()) {
			if(!spawned) {
				clear(entry);
				continue;
			}
			if(now < entry.nextScan) {
				continue;
			}
			entry.nextScan = now + (entry.definition.scanMs ?? SCAN_MS);
			scanSafely(entry);
		}
		for(const prompt of prompts) {
			prompt.refreshKey();
		}
	}
})();

/** Every prompt, every frame, while there are any. Idle otherwise. */
void (async (): Promise<void> => {
	for(;;) {
		if(!prompts.size) {
			await Delay(250);
			continue;
		}

		const [px, py, pz] = GetEntityCoords(PlayerPedId(), true);
		const now = GetGameTimer();
		// One press, one prompt: two in reach on the same key answer as the nearer.
		const pressed = new Map<number, { prompt: Prompt; distance: number }>();

		for(const prompt of prompts) {
			let distance: number;

			try {
				distance = prompt.update(px, py, pz, now);
			} catch(error) {
				prompt.destroy();
				console.log(`[prompts]: a prompt threw while drawing and was dropped. ${describeError(error)}`);
				continue;
			}

			const key = E_CONTROLS.has(prompt.answers) ? 38 : prompt.answers;
			const best = pressed.get(key);

			if(distance >= 0 && (!best || distance < best.distance)) {
				pressed.set(key, { prompt, distance });
			}
		}
		for(const { prompt, distance } of pressed.values()) {
			try {
				prompt.press(distance);
			} catch(error) {
				console.log(`[prompts]: '${prompt.words}' threw when its key was pressed. ${describeError(error)}`);
			}
		}
		await Delay(0);
	}
})();

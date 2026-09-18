/*
 * Screen-space text drawing: `drawText` at a screen position, `drawTextFromWorld` anchored to a
 * world position, and the fading game texts the server can push.
 */
import { GameText, Font } from '@shared/gui';

export const justification = Object.freeze({
	CENTER: 0,
	LEFT: 1,
	RIGHT: 2,
});

export interface DrawTextOptions {
	font?: number;
	scale?: number;
	color?: [number, number, number, number];
	align?: number;
	outline?: boolean;
	shadow?: boolean;
	/** Left and right screen x to wrap between; without it text runs off the edge. */
	wrap?: [number, number] | null;
}

const DEFAULT_OPTIONS: Required<DrawTextOptions> = {
	align: justification.CENTER,
	font: Font.ChaletComprimeCologne,
	scale: 0.5,
	outline: true,
	shadow: false,
	color: [255, 255, 255, 255],
	wrap: null,
};

/**
 * Feed a string into the text command that is already open, in components it will accept: a
 * single component truncates at 99 characters, and there are three slots.
 */
export const addTextComponents = (text: string): void => {
	let remaining = text;
	let components = 0;

	while(remaining.length > 0 && components < 3) {
		components++;
		if(remaining.length <= 99) {
			AddTextComponentSubstringPlayerName(remaining);
			break;
		}

		let cut = 99;
		const unsafe = (at: number): boolean => {
			const tildes = remaining.slice(0, at).split('~').length - 1;

			if(tildes % 2 === 1) {
				return true;
			}
			return /\w/.test(remaining[at - 1] ?? '') && /\w/.test(remaining[at] ?? '');
		};

		while(cut > 1 && unsafe(cut)) {
			cut--;
		}
		AddTextComponentSubstringPlayerName(remaining.slice(0, cut));
		remaining = remaining.slice(cut);
	}
};

export const drawText = (text: string, position2d: [number, number], options: DrawTextOptions = {}): void => {
	const merged = { ...DEFAULT_OPTIONS, ...options };

	SetTextFont(merged.font);
	SetTextScale(merged.scale, merged.scale);
	SetTextColour(merged.color[0], merged.color[1], merged.color[2], merged.color[3]);
	if(merged.outline) {
		SetTextOutline();
	}
	if(merged.shadow) {
		SetTextDropShadow();
	}
	switch(merged.align) {
		case justification.CENTER:
			SetTextCentre(true);
			break;
		case justification.RIGHT:
			SetTextRightJustify(true);
			SetTextWrap(0.0, position2d[0] || 0);
			break;
		default:
			SetTextJustification(merged.align);
			break;
	}
	if(merged.wrap) {
		SetTextWrap(merged.wrap[0], merged.wrap[1]);
	}
	BeginTextCommandDisplayText('THREESTRINGS');
	addTextComponents(text);
	EndTextCommandDisplayText(position2d[0], position2d[1]);
};

/** How many lines the text takes when wrapped between two screen x positions. */
export const getWrappedLineCount = (text: string, wrap: [number, number], scale: number, font = 4): number => {
	SetTextFont(font);
	SetTextScale(scale, scale);
	SetTextWrap(wrap[0], wrap[1]);
	BeginTextCommandLineCount('THREESTRINGS');
	addTextComponents(text);
	return EndTextCommandLineCount(wrap[0], 0.0);
};

export const getTextWidth = (text: string, scale: number, font = 4): number => {
	BeginTextCommandGetWidth('STRING');
	AddTextComponentSubstringPlayerName(text);
	SetTextFont(font);
	SetTextScale(scale, scale);
	return EndTextCommandGetWidth(true);
};

/** Text anchored to a world position. */
export const drawTextFromWorld = (
	text: string,
	position: [number, number, number],
	font: number,
	color: [number, number, number, number],
	scale: number,
): void => {
	const [found, x, y] = GetScreenCoordFromWorldCoord(position[0], position[1], position[2]);

	if(!found) {
		return;
	}
	SetTextFont(font);
	SetTextScale(scale, scale);
	SetTextColour(color[0], color[1], color[2], color[3]);
	SetTextOutline();
	SetTextCentre(true);
	BeginTextCommandDisplayText('THREESTRINGS');
	addTextComponents(text);
	EndTextCommandDisplayText(x, y);
};

// ─── game texts: a line on screen for a while, fading ───────────────────────

const currentGameTexts: GameText[] = [];

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const addCustomGameText = (
	text: string,
	time = 4000,
	fontSize = 0.5,
	drawXY: [number, number] = [0.5, 0.5],
	colorRGBA: [number, number, number, number] = [255, 255, 255, 255],
	font = 0,
	fade: boolean | 'pulse' = false,
	fadeToXY: [number, number] = [0.5, 0.5],
	justificationId = 0,
): GameText => {
	const entry: GameText = {
		message: text,
		baseTime: time,
		time: time === -1 ? time : Date.now() + time,
		font,
		fontSize,
		baseDrawXY: [...drawXY],
		drawXY,
		colors: [...colorRGBA] as [number, number, number, number],
		fade,
		fadeToXY,
		justification: justificationId,
		limit: 0.0,
		pulseTime: 1.0,
		maxAlpha: 255,
	};

	currentGameTexts.push(entry);
	return entry;
};

export const removeCustomGameText = (gametext: GameText): void => {
	const index = currentGameTexts.indexOf(gametext);

	if(index !== -1) {
		currentGameTexts.splice(index, 1);
	}
};

const processGameTexts = (deltaTime: number): void => {
	const timestamp = Date.now();

	for(let i = currentGameTexts.length - 1; i >= 0; i--) {
		const entry = currentGameTexts[i];

		if(entry.time < timestamp && entry.time !== -1) {
			removeCustomGameText(entry);
			continue;
		}
		if(entry.fade !== false && entry.time !== -1) {
			const currentTime = (entry.time - timestamp) / entry.baseTime;

			if(entry.fade === 'pulse') {
				const alphaChange = deltaTime / entry.pulseTime / 2.0;
				const sign = 2 * entry.limit - 1;

				entry.colors[3] += sign * alphaChange;
				if(entry.colors[3] * sign >= entry.limit) {
					entry.colors[3] = entry.limit;
					entry.limit = entry.maxAlpha - entry.limit;
				}
			} else {
				entry.colors[3] = Math.round(lerp(0, 255, currentTime));
			}
			entry.drawXY[0] = lerp(entry.fadeToXY[0], entry.baseDrawXY[0], currentTime);
			entry.drawXY[1] = lerp(entry.fadeToXY[1], entry.baseDrawXY[1], currentTime);
		}
		drawText(entry.message, [entry.drawXY[0], entry.drawXY[1]], { font: entry.font, color: entry.colors, scale: entry.fontSize, align: entry.justification });
	}
};

let previousTick = Date.now();

setTick(() => {
	const now = Date.now();
	const deltaTime = now - previousTick;

	previousTick = now;
	if(currentGameTexts.length) {
		processGameTexts(deltaTime);
	}
});

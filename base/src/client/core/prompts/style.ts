/*
 * How a floating prompt looks, and the primitives that draw it.
 *
 * Far off it is a dot inside a ring. Close enough to use, the ring opens out into the key cap
 * and the label slides out beside it. The game has no primitive for a circle or a skewed box,
 * so everything is built out of DrawRect: a filled circle from horizontal slices, a ring from
 * squares walked round the curve, a parallelogram from slices each shifted a little.
 */
import { Font } from '@shared/gui';

export type Rgba = readonly [number, number, number, number];

export const STYLE = Object.freeze({
	keyFont: Font.Monospace,
	labelFont: Font.Monospace,
	scale: 0.32,
	keyScale: 0.32,
	/** Where a line of text sits inside the height the game reports for it: the dial for a letter sitting wrong in its cap. */
	textCentre: 0.52,
	keyGlyphHeight: 0.38,
	margin: 0.0025,
	padding: 0.0009,

	dotSize: 0.0019,
	ringSize: 0.0038,
	ringSpriteScale: 1.26,
	ringLine: 0.00065,
	ringLineMin: 0.00045,
	pulse: 0.035,
	pulseAlpha: 0.3,
	pulseSpeed: 0.0022,
	slicePixels: 0.85,
	sliceMin: 12,
	sliceMax: 64,
	circleOverlap: 1.5,
	ringSegmentOverlap: 0.5,
	ringSegmentsMin: 16,
	ringSegmentsMax: 96,

	capSize: 0.0072,
	capNudge: 0.0011,
	slant: 0.34,
	slantSlices: 16,

	cap: [255, 255, 255, 255] as Rgba,
	keyColour: [92, 92, 99, 255] as Rgba,
	labelColour: [255, 255, 255, 255] as Rgba,
	dot: [255, 255, 255, 240] as Rgba,
	ring: [255, 255, 255, 130] as Rgba,

	rowGap: 0.0034,
	open: 0.085,
	drawDistance: 6.0,
	interactDistance: 2.0,
	scaleNear: 0.95,
	scaleFar: 0.55,
	scaleFarAt: 8.0,
});

export const rect = (x: number, y: number, w: number, h: number, colour: Rgba, alpha = 1): void => {
	DrawRect(x, y, w, h, colour[0], colour[1], colour[2], Math.round(colour[3] * alpha));
};

export const drawText = (text: string, x: number, y: number, scale: number, font: number, colour: Rgba, centred: boolean, outline: boolean): void => {
	SetTextFont(font);
	SetTextScale(scale, scale);
	SetTextColour(colour[0], colour[1], colour[2], colour[3]);
	SetTextCentre(centred);
	if(outline) {
		SetTextOutline();
	}
	BeginTextCommandDisplayText('STRING');
	AddTextComponentSubstringPlayerName(text);
	EndTextCommandDisplayText(x, y);
};

export const textWidth = (text: string, scale: number, font: number): number => {
	BeginTextCommandGetWidth('STRING');
	AddTextComponentSubstringPlayerName(text);
	SetTextFont(font);
	SetTextScale(scale, scale);
	return EndTextCommandGetWidth(true);
};

export const promptFont = (which: 'key' | 'label'): number => (which === 'key' ? STYLE.keyFont : STYLE.labelFont);

const slicesFor = (radius: number, aspect: number): number => (
	Math.max(STYLE.sliceMin, Math.min(STYLE.sliceMax, Math.round((radius * 2 * aspect * 1080) / STYLE.slicePixels)))
);

/** A filled circle: one rect per horizontal slice, each as wide as the chord at that height. */
export const drawCircle = (x: number, y: number, radius: number, aspect: number, colour: Rgba, alpha: number): void => {
	const slices = slicesFor(radius, aspect);
	const sliceHeight = (radius * 2 * aspect) / slices;

	for(let i = 0; i < slices; i++) {
		const t = ((i + 0.5) / slices) * 2 - 1;
		const halfWidth = radius * Math.sqrt(Math.max(0, 1 - t * t));

		if(halfWidth > 0) {
			rect(x, y + t * radius * aspect, halfWidth * 2, sliceHeight * STYLE.circleOverlap, colour, alpha);
		}
	}
};

/** A ring: small squares walked round the circumference, overlapping into a stroke. */
export const drawRing = (x: number, y: number, radius: number, line: number, aspect: number, colour: Rgba, alpha: number): void => {
	const spacing = Math.max(line * STYLE.ringSegmentOverlap, 0.00001);
	const segments = Math.max(STYLE.ringSegmentsMin, Math.min(STYLE.ringSegmentsMax, Math.ceil((2 * Math.PI * radius) / spacing)));

	for(let i = 0; i < segments; i++) {
		const angle = (i / segments) * Math.PI * 2;

		rect(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * aspect, line, line * aspect, colour, alpha);
	}
};

/** Part of a ring, clockwise from the top: for a countdown that fills. */
export const drawArc = (x: number, y: number, radius: number, line: number, aspect: number, fraction: number, colour: Rgba, alpha: number): void => {
	const spacing = Math.max(line * STYLE.ringSegmentOverlap, 0.00001);
	const segments = Math.max(STYLE.ringSegmentsMin, Math.min(STYLE.ringSegmentsMax, Math.ceil((2 * Math.PI * radius) / spacing)));
	const drawn = Math.round(segments * Math.min(1, Math.max(0, fraction)));

	for(let i = 0; i < drawn; i++) {
		const angle = -Math.PI / 2 + (i / segments) * Math.PI * 2;

		rect(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * aspect, line, line * aspect, colour, alpha);
	}
};

/** A parallelogram, centred on x/y: the key cap, leaning back like the italic on a key legend. */
export const drawSlanted = (x: number, y: number, w: number, h: number, slantBy: number, colour: Rgba, alpha = 1): void => {
	const slices = STYLE.slantSlices;
	const sliceHeight = h / slices;
	const drawHeight = sliceHeight * 1.5;

	for(let i = 0; i < slices; i++) {
		const along = (i + 0.5) / slices - 0.5;

		rect(x - slantBy * along, y - h / 2 + sliceHeight * (i + 0.5), w, drawHeight, colour, alpha);
	}
};

/*
 * The dot is a texture (a clean filled disc); the ring is drawn, because a texture's line
 * thickens as it grows and the drawn one's stroke is a number.
 */
const DOT_DICT = 'mpinventory';
const DOT_TEXTURE = 'in_world_circle';

let dotLoaded = false;

RequestStreamedTextureDict(DOT_DICT, false);

export const drawDot = (x: number, y: number, radius: number, aspect: number, colour: Rgba, alpha: number): void => {
	if(!dotLoaded) {
		dotLoaded = HasStreamedTextureDictLoaded(DOT_DICT);
	}
	if(dotLoaded) {
		DrawSprite(DOT_DICT, DOT_TEXTURE, x, y, radius * 2, radius * 2 * aspect, 0, colour[0], colour[1], colour[2], Math.round(colour[3] * alpha));
		return;
	}
	drawCircle(x, y, radius, aspect, colour, alpha);
};

export const drawRingShape = (x: number, y: number, radius: number, line: number, aspect: number, colour: Rgba, alpha: number): void => {
	drawRing(x, y, radius, line, aspect, colour, alpha);
};

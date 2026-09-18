/* A ring that fills, pinned over something in the world: a countdown you can see where it is happening. */
import { Rgba, drawArc, drawRing, drawText, promptFont } from './style';

const RING = Object.freeze({
	radius: 0.018,
	track: 0.0012,
	fill: 0.0026,
	trackColour: [255, 255, 255, 90] as Rgba,
	fillColour: [224, 50, 50, 235] as Rgba,
	labelColour: [255, 255, 255, 235] as Rgba,
	labelScale: 0.3,
	labelGap: 0.006,
});

/** One frame of a ring `fraction` full at a world position, with a label under it. */
export const drawProgressRing = (x: number, y: number, z: number, fraction: number, label: string): void => {
	const [width, height] = GetActiveScreenResolution();
	const aspect = width / height;

	SetDrawOrigin(x, y, z, 0);
	drawRing(0, 0, RING.radius, RING.track, aspect, RING.trackColour, 1);
	drawArc(0, 0, RING.radius, RING.fill, aspect, fraction, RING.fillColour, 1);
	drawText(label, 0, RING.radius * aspect + RING.labelGap, RING.labelScale, promptFont('label'), RING.labelColour, true, true);
	ClearDrawOrigin();
};

/** GTA's text fonts, by the names the game uses for them. */
export const Font = Object.freeze({
	ChaletLondon: 0,
	HouseScript: 1,
	Monospace: 2,
	ChaletComprimeCologne: 4,
	Pricedown: 7,
});

export interface GameText {
	message: string;
	baseTime: number;
	time: number;
	font: number;
	fontSize: number;
	baseDrawXY: [number, number];
	drawXY: [number, number];
	colors: [number, number, number, number];
	fade: boolean | 'pulse';
	fadeToXY: [number, number];
	justification: number;
	limit: number;
	pulseTime: number;
	maxAlpha: number;
}

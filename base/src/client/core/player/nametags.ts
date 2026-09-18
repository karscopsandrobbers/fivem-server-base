/*
 * A name and id over every player in range, drawn in the world. The colour comes off their bag
 * (`nameTagColour`, a hex string) when the server sets one.
 */
import { drawTextFromWorld } from '../../gui';
import { createGatedTick } from '../lifecycle';
import { forEachInStreamRange, localPlayer } from './nativeHooks';

const RANGE = 30.0;
const HEIGHT = 1.05;
const FONT = 4;
const SCALE = 0.36;

const hexToRgba = (hex: string): [number, number, number, number] => {
	const value = parseInt(hex.replace('#', ''), 16);

	return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
};

createGatedTick(() => localPlayer.isSpawned() && GetActivePlayers().length > 1, () => {
	const self = PlayerPedId();
	const [px, py, pz] = GetEntityCoords(self, true);

	forEachInStreamRange(player => {
		const ped = player.ped;

		if(!ped || !DoesEntityExist(ped) || !IsEntityOnScreen(ped)) {
			return;
		}

		const [x, y, z] = GetEntityCoords(ped, true);

		if(Vdist(px, py, pz, x, y, z) > RANGE || !HasEntityClearLosToEntity(self, ped, 17)) {
			return;
		}

		const colour = player.getVariable('nameTagColour');
		const rgba = typeof colour === 'string' && colour.length === 6 ? hexToRgba(colour) : [255, 255, 255, 255] as [number, number, number, number];

		drawTextFromWorld(`${player.name} (${player.serverId})`, [x, y, z + HEIGHT], FONT, rgba, SCALE);
	});
});

/*
 * Player blips. The server publishes `blipSprite`, `blipColour` and `blipAlpha` on each player's
 * bag (all optional); this side owns the handles, which are per-machine. Blips are entity-bound,
 * so they are created as players stream in and removed as they stream out.
 */
import { onResourceStop } from '../lifecycle';
import { ClientPlayer, addDataHandler, forEachInStreamRange, localPlayer } from './nativeHooks';

const DEFAULT_SPRITE = 1;
const DEFAULT_COLOUR = 0;
const REFRESH_MS = 1000;

const blips = new Map<number, number>();

const destroyBlip = (serverId: number): void => {
	const blip = blips.get(serverId);

	if(blip !== undefined) {
		if(DoesBlipExist(blip)) {
			RemoveBlip(blip);
		}
		blips.delete(serverId);
	}
};

const updateBlip = (player: ClientPlayer): void => {
	if(!player.exists || player.serverId === localPlayer.serverId) {
		return;
	}

	const sprite = player.getVariable('blipSprite');

	// -1 hides them: spectating, invisibility.
	if(sprite === -1) {
		destroyBlip(player.serverId);
		return;
	}

	const ped = player.ped;

	if(!ped || !DoesEntityExist(ped)) {
		destroyBlip(player.serverId);
		return;
	}

	let blip = blips.get(player.serverId);

	// A blip is bound to an entity handle, so a ped respawn invalidates it.
	if(blip !== undefined && (!DoesBlipExist(blip) || GetBlipInfoIdEntityIndex(blip) !== ped)) {
		destroyBlip(player.serverId);
		blip = undefined;
	}
	if(blip === undefined) {
		blip = AddBlipForEntity(ped);
		blips.set(player.serverId, blip);
	}

	const colour = player.getVariable('blipColour');
	const alpha = player.getVariable('blipAlpha');

	SetBlipSprite(blip, typeof sprite === 'number' ? sprite : DEFAULT_SPRITE);
	SetBlipColour(blip, typeof colour === 'number' ? colour : DEFAULT_COLOUR);
	SetBlipAlpha(blip, typeof alpha === 'number' ? alpha : 255);
	SetBlipCategory(blip, 7);
	SetBlipPriority(blip, 1);
	ShowHeadingIndicatorOnBlip(blip, true);
	SetBlipAsShortRange(blip, false);
	SetBlipNameToPlayerName(blip, player.handle);
};

for(const key of ['blipSprite', 'blipColour', 'blipAlpha']) {
	addDataHandler(key, player => updateBlip(player));
}

setInterval(() => {
	const seen = new Set<number>();

	forEachInStreamRange(player => {
		seen.add(player.serverId);
		updateBlip(player);
	});
	for(const serverId of [...blips.keys()]) {
		if(!seen.has(serverId)) {
			destroyBlip(serverId);
		}
	}
}, REFRESH_MS);

onResourceStop(() => {
	for(const serverId of [...blips.keys()]) {
		destroyBlip(serverId);
	}
});

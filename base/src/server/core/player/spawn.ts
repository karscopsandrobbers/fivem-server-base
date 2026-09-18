/*
 * Where a player lands: a random Los Santos spawn on joining, and again a few seconds after dying.
 */
import { EVENTS } from '@shared/events';
import { getRandomOfArraySet } from '@shared/index';
import { RESPAWN_SECONDS, SPAWNS, SPAWN_MODELS } from '@shared/world/spawns';
import type EntityPlayer from '../entities/PlayerEntity';

export const spawnRandomly = (player: EntityPlayer): void => {
	const spawn = getRandomOfArraySet(SPAWNS);

	if(!player.info.model) {
		player.info.model = getRandomOfArraySet(SPAWN_MODELS);
		player.model = GetHashKey(player.info.model) >>> 0;
	}
	player.spawn(spawn.position, spawn.heading, player.info.model);
};

/** The client's session is up. Nothing is loaded in this base, so the spawn follows at once. */
onNet(EVENTS.PLAYER_READY, () => {
	const player = globalThis.mp.players.at(source);

	if(player && !player.info.ready) {
		player.info.ready = true;
		spawnRandomly(player);
	}
});

onNet(EVENTS.PLAYER_SPAWNED, () => {
	const player = globalThis.mp.players.at(source);

	if(!player) {
		return;
	}

	const first = !player.isSpawned();

	player.data.spawned = true;
	player.data.spawnCount = (player.data.spawnCount ?? 0) + 1;
	if(first) {
		player.languageMessage('WELCOME', player.name);
		player.showShard('~g~Welcome', player.name, 4000);
	}
	globalThis.mp.logger.info(`[spawn]: ${player.getUsername()} spawned at ${JSON.stringify(player.position)}.`);
});

/** The client saw its own ped die; the server puts them back after a moment. */
onNet(EVENTS.PLAYER_DIED, () => {
	const player = globalThis.mp.players.at(source);

	if(!player?.isSpawned() || player.info.respawning) {
		return;
	}
	player.info.respawning = true;
	globalThis.mp.logger.info(`[spawn]: ${player.getUsername()} died.`);
	setTimeout(() => {
		player.info.respawning = false;
		if(globalThis.mp.players.exists(player.id)) {
			spawnRandomly(player);
		}
	}, RESPAWN_SECONDS * 1000);
});

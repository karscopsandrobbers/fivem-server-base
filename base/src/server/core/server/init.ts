/*
 * Boot, join, leave, shutdown.
 *
 * playerJoining's only argument is the previous id; the connecting player's net id is the ambient
 * `source` global. A resource restart does not re-fire it for anybody already connected, so the
 * pool is rebuilt from getPlayers() at start.
 */
import { loadLanguages, messageToAll } from '../i18n';
import { loadLanguage } from '../i18n/events';
import EntityPlayer from '../entities/PlayerEntity';

process.on('uncaughtException', exception => {
	globalThis.mp.logger.error(`[uncaughtException]: ${exception}\n${exception.stack}`);
});

process.on('unhandledRejection', reason => {
	const detail = reason instanceof Error ? (reason.stack ?? reason.message) : JSON.stringify(reason);

	globalThis.mp.logger.error(`[unhandledRejection]: ${detail}`);
});

on('onResourceStart', (resourceName: string) => {
	if(GetCurrentResourceName() !== resourceName) {
		return;
	}
	globalThis.mp.logger.info(`Resource '${resourceName}' started. Node ${process.version}${globalThis.developmentMode ? ', dev mode' : ''}.`);
	loadLanguages();
	globalThis.mp.players.resync();
	for(const player of globalThis.mp.players) {
		loadLanguage(player);
	}
});

/*
 * Entities the server made are deleted on the way out: a server-created entity outlives the
 * resource that made it, and every `restart base` would otherwise leave its peds standing.
 */
on('onResourceStop', (resourceName: string) => {
	if(GetCurrentResourceName() !== resourceName) {
		return;
	}

	const vehicles = globalThis.mp.vehicles.destroyAll();
	const peds = globalThis.mp.peds.destroyAll();
	const objects = globalThis.mp.objects.destroyAll();

	globalThis.mp.logger.info(`Resource '${resourceName}' stopped. Removed ${vehicles} vehicle(s), ${peds} ped(s), ${objects} object(s).`);
});

onNet('playerJoining', () => {
	const player = globalThis.mp.players.add(new EntityPlayer(source));

	loadLanguage(player);
	globalThis.mp.logger.info(`[playerJoining]: ${player.getUsername()}, license ${player.license || '-'}. Online: ${globalThis.mp.players.length}.`);
	messageToAll('PLAYER_JOINED', player.name);
});

onNet('playerDropped', (reason: string) => {
	const player = globalThis.mp.players.at(source);

	if(player) {
		globalThis.mp.peds.destroyFromController(player);
		globalThis.mp.players.remove(player);
		messageToAll('PLAYER_LEFT', player.name, reason);
	}
	globalThis.mp.logger.info(`[playerDropped]: ${player?.getUsername() ?? source}. Reason: ${reason}. Online: ${globalThis.mp.players.length}.`);
});

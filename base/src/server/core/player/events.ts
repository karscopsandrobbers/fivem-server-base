/* What the client tells the server about itself, kept on the player's bag for everyone else. */
import { EVENTS } from '@shared/events';

onNet(EVENTS.PLAYER_UPDATE_LOCATION, (streetName: unknown, zoneName: unknown) => {
	const player = globalThis.mp.players.at(source);

	if(!player) {
		return;
	}

	const street = typeof streetName === 'string' ? streetName : '';
	const zone = typeof zoneName === 'string' ? zoneName : '';

	player.data.street = street;
	player.data.zone = zone;
	player.data.location = [street, zone].filter(part => part.length).join(', ') || 'Unknown';
});

onNet(EVENTS.CLIENT_FEEDBACK, (feedback: unknown) => {
	const player = globalThis.mp.players.at(source);

	if(typeof feedback === 'string' && feedback.length) {
		globalThis.mp.logger.info(`[client; ${player?.getUsername() ?? source}]: ${feedback.slice(0, 512)}`);
	}
});

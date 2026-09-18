/* `player.alpha` on the server: applied by every client that has the ped, off the bag. */
import { addDataHandler, forEachInStreamRange, localPlayer } from './nativeHooks';

const apply = (ped: number, alpha: unknown): void => {
	if(ped && DoesEntityExist(ped)) {
		const value = typeof alpha === 'number' ? alpha : 255;

		if(value >= 255) {
			ResetEntityAlpha(ped);
		} else {
			SetEntityAlpha(ped, value, false);
		}
	}
};

addDataHandler('alpha', (player, value) => apply(player.ped, value));

// Peds stream in with the alpha already set; the handler alone would miss them.
setInterval(() => {
	forEachInStreamRange(player => {
		const alpha = player.getVariable('alpha');

		if(typeof alpha === 'number' && alpha < 255) {
			apply(player.ped, alpha);
		}
	});
	apply(PlayerPedId(), localPlayer.getVariable('alpha'));
}, 2000);

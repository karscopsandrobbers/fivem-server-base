/* Street and zone, reported when they change so the server can say where a player is. */
import { EVENTS } from '@shared/events';
import { getLocationInformation } from '../../modules/utils';
import { localPlayer } from './nativeHooks';

let last = '';

setInterval(() => {
	if(!localPlayer.isSpawned()) {
		return;
	}

	const [x, y, z] = GetEntityCoords(PlayerPedId(), true);
	const [zone, street] = getLocationInformation({ x, y, z });
	const key = `${street}|${zone}`;

	if(key !== last) {
		last = key;
		emitNet(EVENTS.PLAYER_UPDATE_LOCATION, street, zone);
	}
}, 3000);

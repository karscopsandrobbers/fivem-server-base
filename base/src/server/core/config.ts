/*
 * The `mp` namespace: RAGE:MP's top-level pools, in one discoverable place.
 *
 * The vehicle pool and the world registry are getters on purpose: config.ts runs first, and
 * importing those modules at the top would be a cycle that yields a half-initialised module. A
 * getter defers the read to call time, when everything has loaded.
 */
import { logger } from '../utils/logger';
import EntityPlayersPool from './entities/PlayersEntity';
import EntityPedsPool from './entities/PedsEntity';
import EntityObjectsPool from './entities/ObjectsEntity';
import { vehiclesPool } from './vehicles/pool';
import { world } from './world';
import { Vector3 } from '@shared/math/Vector3';
import { Vector2 } from '@shared/math/Vector2';
import { Vector4 } from '@shared/math/Vector4';

// `set base_dev 1` in server.cfg turns the debug log on.
globalThis.developmentMode = GetConvarInt('base_dev', 0) === 1;

globalThis.mp = {
	name: 'base',
	logger,
	players: new EntityPlayersPool(),
	objects: new EntityObjectsPool(),
	peds: new EntityPedsPool(),

	get vehicles() {
		return vehiclesPool;
	},

	get world() {
		return world;
	},

	Vector3,
	Vector2,
	Vector4,
};

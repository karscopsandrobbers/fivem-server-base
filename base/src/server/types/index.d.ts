import type EntityPlayer from '../core/entities/PlayerEntity';
import type EntityPlayersPool from '../core/entities/PlayersEntity';
import type EntityObjectsPool from '../core/entities/ObjectsEntity';
import type EntityVehiclesPool from '../core/entities/VehiclesEntity';
import type EntityPedsPool from '../core/entities/PedsEntity';
import type { Logger } from '../utils/logger';
import type { WorldRegistry } from '../core/world';
import type { Vector3 } from '../../utils/shared/math/Vector3';
import type { Vector2 } from '../../utils/shared/math/Vector2';
import type { Vector4 } from '../../utils/shared/math/Vector4';

export type PlayerMp = EntityPlayer;

/**
 * The `mp` namespace: every pool in one discoverable place, RAGE:MP style. The pools are typed off
 * the real implementations so a change to a pool cannot drift from its declaration.
 */
export type Mp = {
	name: string;
	logger: Logger;

	players: EntityPlayersPool;
	objects: EntityObjectsPool;
	readonly vehicles: EntityVehiclesPool;
	peds: EntityPedsPool;
	/** Replicated world state and the blip / marker / label registries the clients draw. */
	readonly world: WorldRegistry;

	Vector3: typeof Vector3;
	Vector2: typeof Vector2;
	Vector4: typeof Vector4;
};

export declare const mp: Mp;

/*
 * Creating and removing vehicles, and keeping the pool honest about vehicles the engine makes
 * without us (a player's client can spawn one too).
 */
import { EVENTS } from '@shared/events';
import { Vector3Interface } from '@shared/math/Vector3';
import EntityVehicle from '../entities/VehicleEntity';
import { vehiclesPool } from './pool';

export { vehiclesPool };

/**
 * What CREATE_VEHICLE_SERVER_SETTER accepts. Anything else is refused outright, so the type is a
 * choice the caller makes: a bike, a boat and a helicopter each need their own.
 */
export type ServerVehicleType = 'automobile' | 'bike' | 'boat' | 'heli' | 'plane' | 'submarine' | 'trailer' | 'train';

export interface CreateVehicleOptions {
	type?: ServerVehicleType;
	dimension?: number;
	numberPlate?: string;
	locked?: boolean;
	/** [primary, secondary] paint indices; unset keeps the model's own. */
	colour?: [number, number];
}

/** A server-created entity is not addressable on the tick that creates it. */
export const waitForEntity = (entity: number, timeoutMs = 1000): Promise<boolean> => new Promise(resolve => {
	const deadline = Date.now() + timeoutMs;
	const check = (): void => {
		if(DoesEntityExist(entity)) {
			resolve(true);
		} else if(Date.now() >= deadline) {
			resolve(false);
		} else {
			setTimeout(check, 0);
		}
	};

	check();
});

export const createVehicle = async (model: string | number, position: Vector3Interface, heading = 0.0, options: CreateVehicleOptions = {}): Promise<EntityVehicle | null> => {
	const hash = typeof model === 'number' ? model : GetHashKey(model);
	const handle = CreateVehicleServerSetter(hash, options.type ?? 'automobile', position.x, position.y, position.z, heading);

	if(!handle || !await waitForEntity(handle)) {
		globalThis.mp.logger.error(`[vehicles]: failed to create '${model}'.`);
		return null;
	}
	// Server-created entities outlive whichever client happened to be nearest to them.
	SetEntityOrphanMode(handle, 2);

	const vehicle = vehiclesPool.adopt(handle);

	vehicle.locked = options.locked ?? false;
	vehicle.engine = true;
	if(typeof options.dimension === 'number') {
		vehicle.dimension = options.dimension;
	}
	if(options.numberPlate) {
		vehicle.numberPlate = options.numberPlate;
	}
	if(options.colour) {
		vehicle.setColor(options.colour[0], options.colour[1]);
	}
	return vehicle;
};

export const destroyVehicle = (vehicle: EntityVehicle | number | null | undefined): void => {
	vehiclesPool.destroy(vehicle);
};

/** Every vehicle the server can see joins the pool, ours or not, so `mp.vehicles` is the whole world. */
on('entityCreated', (handle: number) => {
	if(DoesEntityExist(handle) && GetEntityType(handle) === 2) {
		vehiclesPool.adopt(handle);
	}
});

on('entityRemoved', (handle: number) => {
	vehiclesPool.remove(handle);
});

/** E on a vehicle: anyone may lock or unlock it, this being a base with no ownership rules yet. */
onNet(EVENTS.SERVER_VEHICLE_TOGGLE_LOCK, (netId: unknown) => {
	const player = globalThis.mp.players.at(source);
	const vehicle = typeof netId === 'number' ? vehiclesPool.atNetId(netId) : null;

	if(!player?.isSpawned() || !vehicle?.exists || vehicle.position.distance(player.position) > 8.0) {
		return;
	}
	vehicle.locked = !vehicle.locked;
	player.languageNotify(vehicle.locked ? 'VEHICLE_LOCKED' : 'VEHICLE_UNLOCKED');
	player.playSound(vehicle.locked ? 'Lock' : 'Unlock', 'DLC_HEISTS_DOOR_SOUNDS');
});

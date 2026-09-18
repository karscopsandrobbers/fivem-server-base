/*
 * The vehicle pool. `adopt` is idempotent and keyed on the handle: FiveM raises `entityCreated`
 * for every vehicle the server can see, ours and everybody else's, so the same handle must always
 * resolve to the same instance.
 */
import { Vector3Interface } from '@shared/math/Vector3';
import EntityPool from './EntityPool';
import EntityVehicle from './VehicleEntity';

class EntityVehiclesPool extends EntityPool<EntityVehicle> {
	adopt(handle: number): EntityVehicle {
		return super.at(handle) ?? this.add(new EntityVehicle(handle));
	}

	at(vehicle: EntityVehicle | number | string | null | undefined): EntityVehicle | null {
		if(vehicle === null || vehicle === undefined) {
			return null;
		}
		return super.at(typeof vehicle === 'object' ? vehicle.handle : vehicle);
	}

	/** In the pool AND still known to the engine: a vehicle can be deleted by any native without the pool hearing. */
	exists(vehicle: EntityVehicle | number | string | null | undefined): boolean {
		const entity = this.at(vehicle);

		return entity !== null && DoesEntityExist(entity.handle);
	}

	/** Clients address vehicles by network id; this resolves one back to the pool. */
	atNetId(netId: number): EntityVehicle | null {
		return this.at(NetworkGetEntityFromNetworkId(netId));
	}

	/** Delete the vehicle and drop it from the pool. */
	destroy(vehicle: EntityVehicle | number | string | null | undefined): void {
		const entity = this.at(vehicle);

		if(entity) {
			entity.destroy();
			this.remove(entity);
		}
	}

	/** Every vehicle this resource still owns. Returns how many were deleted. */
	destroyAll(): number {
		let removed = 0;

		for(const vehicle of this.toArray()) {
			if(DoesEntityExist(vehicle.handle)) {
				vehicle.destroy();
				removed++;
			}
		}
		this.clear();
		return removed;
	}

	forEachInRange(position: Vector3Interface, range: number, fn: (vehicle: EntityVehicle) => void): void {
		this.forEach(vehicle => {
			if(vehicle.exists && vehicle.position.distance(position) <= range) {
				fn(vehicle);
			}
		});
	}

	/** The nearest vehicle to a position within range, or null. */
	nearest(position: Vector3Interface, range: number): EntityVehicle | null {
		let best: EntityVehicle | null = null;
		let bestDistance = range;

		this.forEachInRange(position, range, vehicle => {
			const distance = vehicle.position.distance(position);

			if(distance <= bestDistance) {
				best = vehicle;
				bestDistance = distance;
			}
		});
		return best;
	}
}

export default EntityVehiclesPool;

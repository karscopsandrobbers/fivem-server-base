/*
 * The object pool. An object can be deleted by any native without the pool being told, so `at`
 * and `exists` ask the engine and drop anything gone.
 */
import { Vector3Interface } from '@shared/math/Vector3';
import EntityObject, { ObjectOptions } from './ObjectEntity';
import EntityPool from './EntityPool';

class EntityObjectsPool extends EntityPool<EntityObject> {
	/** Null rather than a throw when the engine refuses the model. */
	new(model: string | number, position: Vector3Interface, options: ObjectOptions = {}): EntityObject | null {
		const hash = typeof model === 'number' ? model : GetHashKey(model);
		const handle = CreateObjectNoOffset(hash, position.x, position.y, position.z, true, options.netMissionEntity ?? true, options.doorFlag ?? false);

		if(!handle) {
			globalThis.mp.logger.error(`[objects]: CreateObject returned no handle for ${model}.`);
			return null;
		}

		const object = this.add(new EntityObject(handle));

		if(options.rotation) {
			object.rotation = options.rotation;
		}
		if(typeof options.heading === 'number') {
			object.heading = options.heading;
		}
		if(typeof options.dimension === 'number') {
			object.dimension = options.dimension;
		}
		if(options.frozen) {
			object.freeze(true);
		}
		object.setOrphanMode(options.orphanMode ?? 2);

		return object;
	}

	at(entity: EntityObject | number | string): EntityObject | null {
		const object = super.at(entity);

		if(object && !object.exists) {
			this.remove(object);
			return null;
		}
		return object;
	}

	exists(entity: EntityObject | number | string): boolean {
		return this.at(entity) !== null;
	}

	atNetId(netId: number): EntityObject | null {
		return netId ? this.at(NetworkGetEntityFromNetworkId(netId)) : null;
	}

	/** Delete the object and drop it from the pool. */
	destroy(entity: EntityObject | number | string | null | undefined): void {
		if(entity === null || entity === undefined) {
			return;
		}

		const object = super.at(entity as EntityObject | number | string);

		if(object) {
			object.destroy();
			this.remove(object);
		}
	}

	destroyAll(): number {
		let removed = 0;

		for(const object of this.toArray()) {
			if(object.exists) {
				object.destroy();
				removed++;
			}
		}
		this.clear();
		return removed;
	}
}

export default EntityObjectsPool;

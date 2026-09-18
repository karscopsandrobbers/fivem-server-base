/*
 * One server-owned object. `id` is the entity handle. Worth wrapping so the pool can enumerate
 * what this resource spawned and delete it on shutdown; a bare CreateObject outlives its resource.
 */
import { EVENTS } from '@shared/events';
import { TASKS, TaskName, TaskRequest } from '@shared/tasks';
import { Vector3, Vector3Interface } from '@shared/math/Vector3';
import Entity from './Entity';

export interface ObjectOptions {
	rotation?: Vector3Interface;
	/** Degrees. Applied after `rotation`, so pass one or the other. */
	heading?: number;
	/** Routing bucket. */
	dimension?: number;
	frozen?: boolean;
	/** 2 keeps it alive when its owning client leaves, which is what a world prop wants. */
	orphanMode?: number;
	netMissionEntity?: boolean;
	/** Required true for door models in network mode. */
	doorFlag?: boolean;
}

class EntityObject extends Entity {
	constructor(handle: number) {
		super(handle);
	}

	get handle(): number {
		return this.id;
	}

	get exists(): boolean {
		return this.id !== 0 && DoesEntityExist(this.id);
	}

	/** 0 for a moment after `new`; callers that need it immediately wait first. */
	get netId(): number {
		return this.exists ? NetworkGetNetworkIdFromEntity(this.id) : 0;
	}

	/** Ask every client to run a task on this object, by net id. */
	playTask(name: TaskName, ...args: unknown[]): void {
		const netId = this.netId;

		if(!netId) {
			return;
		}
		const request: TaskRequest = { netId, name, args };

		emitNet(EVENTS.TASK_RUN, -1, request);
	}

	/** A looping animation on the prop itself. */
	playAnim(dict: string, anim: string, loop = true, blendIn = 4.0): void {
		this.playTask(TASKS.PLAY_ENTITY_ANIM, dict, anim, blendIn, loop, !loop);
	}

	get position(): Vector3 {
		const [x, y, z] = GetEntityCoords(this.id);

		return new Vector3(x, y, z);
	}

	set position(position: Vector3Interface) {
		SetEntityCoords(this.id, position.x, position.y, position.z, false, false, false, false);
	}

	set rotation(rotation: Vector3Interface) {
		SetEntityRotation(this.id, rotation.x, rotation.y, rotation.z, 2, true);
	}

	set heading(heading: number) {
		SetEntityHeading(this.id, heading);
	}

	get dimension(): number {
		return GetEntityRoutingBucket(this.id);
	}

	set dimension(dimension: number) {
		SetEntityRoutingBucket(this.id, dimension);
	}

	freeze(state = true): void {
		FreezeEntityPosition(this.id, state);
	}

	setOrphanMode(mode: number): void {
		SetEntityOrphanMode(this.id, mode);
	}

	/** Hand the handle back to the engine. Removing it from the pool is the pool's job. */
	destroy(): void {
		if(this.exists) {
			DeleteEntity(this.id);
		}
	}

	toJSON() {
		return { id: this.id, handle: this.handle, exists: this.exists };
	}
}

export default EntityObject;

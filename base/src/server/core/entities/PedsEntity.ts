/*
 * The ped pool. A ped can be deleted by any native without the pool being told, so `at` asks the
 * engine and drops anything gone. Every ped made here is born with a brain: its post is the
 * bottom of the stack, and anything a system asks of it from then on goes through the brain.
 */
import { Vector3Interface } from '@shared/math/Vector3';
import { IdleParams, PED_ROLE } from '@shared/peds/pedBrain';
import EntityPed, { PED_TYPE_CIVMALE, PedConfig, PedOptions } from './PedEntity';
import EntityPool from './EntityPool';
import type EntityPlayer from './PlayerEntity';
import { pedBrain } from '../peds/brain/BrainService';

class EntityPedsPool extends EntityPool<EntityPed> {
	/**
	 * A networked ped with the engine's own defaults. Use `newActor` for one meant to stay where
	 * it was put.
	 */
	new(model: string | number, position: Vector3Interface, options: PedOptions = {}): EntityPed | null {
		const hash = typeof model === 'number' ? model : GetHashKey(model);
		const handle = CreatePed(PED_TYPE_CIVMALE, hash, position.x, position.y, position.z, options.heading ?? 0.0, true, options.scriptHostPed ?? true);

		if(!handle) {
			globalThis.mp.logger.error(`[peds]: CreatePed refused model ${String(model)}.`);
			return null;
		}

		const ped = this.add(new EntityPed(handle, options.controller ?? null));

		if(typeof options.dimension === 'number') {
			ped.dimension = options.dimension;
		}
		if(options.frozen) {
			ped.freeze(true);
		}

		const config: PedConfig = {
			...(typeof options.invincible === 'boolean' ? { invincible: options.invincible } : {}),
			...(options.holdsPost ? { holdsPost: true } : {}),
			...(typeof options.health === 'number' ? { health: options.health } : {}),
			...(typeof options.armour === 'number' ? { armour: options.armour } : {}),
			...(typeof options.canRagdoll === 'boolean' ? { canRagdoll: options.canRagdoll } : {}),
			...(typeof options.suffersCriticalHits === 'boolean' ? { suffersCriticalHits: options.suffersCriticalHits } : {}),
			...(options.relationshipGroup ? { relationshipGroup: options.relationshipGroup } : {}),
			...(options.components?.length ? { components: options.components } : {}),
			...(options.frozen ? { frozen: true } : {}),
		};

		if(Object.keys(config).length) {
			ped.configure(config);
		}

		// The post, as the bottom of the brain's stack. CreatePed's heading does not reliably reach
		// the ped, so the owning client sets it from here.
		const idle: IdleParams = {
			...(options.idle ?? {}),
			...(options.scenario ? { scenario: options.scenario } : {}),
			...(typeof options.heading === 'number' ? { heading: options.heading } : {}),
			...(options.holdsPost ? { home: { x: position.x, y: position.y, z: position.z, heading: options.heading ?? 0.0 } } : {}),
		};

		pedBrain.adopt(handle, options.role ?? PED_ROLE.ACTOR, { idle, origin: { x: position.x, y: position.y, z: position.z } });
		// KeepEntity: a ped placed by the server should still be there once everybody walks away.
		ped.setOrphanMode(options.orphanMode ?? 2);

		return ped;
	}

	/**
	 * An ACTOR: a ped that holds a post. Ignores gunfire, never flees, and is invincible unless
	 * told otherwise. It is still an ordinary networked ped that can be tasked, armed or killed.
	 */
	newActor(model: string | number, position: Vector3Interface, options: PedOptions = {}): EntityPed | null {
		return this.new(model, position, { holdsPost: true, invincible: true, ...options });
	}

	at(entity: EntityPed | number | string): EntityPed | null {
		const ped = super.at(entity);

		if(ped && !ped.exists) {
			pedBrain.forget(ped.handle);
			this.remove(ped);
			return null;
		}
		return ped;
	}

	exists(entity: EntityPed | number | string): boolean {
		return this.at(entity) !== null;
	}

	atNetId(netId: number): EntityPed | null {
		return netId ? this.at(NetworkGetEntityFromNetworkId(netId)) : null;
	}

	/** Delete the ped and drop it from the pool. The brain goes first. */
	destroy(entity: EntityPed | number | string | null | undefined): void {
		if(entity === null || entity === undefined) {
			return;
		}

		const ped = super.at(entity as EntityPed | number | string);

		if(ped) {
			pedBrain.forget(ped.handle);
			ped.destroy();
			this.remove(ped);
		}
	}

	/** Everything a departing player owned. */
	destroyFromController(player: EntityPlayer | null | undefined): void {
		if(!player) {
			return;
		}
		for(const ped of this.toArray()) {
			if(ped.controller === player) {
				this.destroy(ped);
			}
		}
	}

	destroyAll(): number {
		let removed = 0;

		for(const ped of this.toArray()) {
			pedBrain.forget(ped.handle);
			if(ped.exists) {
				ped.destroy();
				removed++;
			}
		}
		this.clear();
		return removed;
	}
}

export default EntityPedsPool;

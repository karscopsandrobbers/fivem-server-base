/*
 * One server-owned ped. `id` is the entity handle.
 *
 * Two bags. `pedConfig` is what the ped IS: health, look, whether it holds its post; every client
 * that streams it in applies it once (client/core/peds). What the ped is DOING is the `brain` bag
 * (peds/brain), performed by the one client that controls it.
 */
import { Vector3, Vector3Interface } from '@shared/math/Vector3';
import type { IdleParams, PedRole } from '@shared/peds/pedBrain';
// Aliased: the base class would otherwise shadow FiveM's `Entity(handle).state` native.
import BaseEntity from './Entity';
import type EntityPlayer from './PlayerEntity';

/** PED_TYPE_CIVMALE. Unused by the engine (the model decides) but required by CreatePed. */
export const PED_TYPE_CIVMALE = 4;

/** Component variations, [component, drawable, texture] each. */
export type PedComponents = Array<[number, number, number]>;

export interface PedOptions {
	heading?: number;
	/** Routing bucket. */
	dimension?: number;
	frozen?: boolean;
	/** Client-applied: SetEntityInvincible is client-only, so it rides the bag. */
	invincible?: boolean;
	/** The player this ped belongs to, so it is cleaned up when they leave. */
	controller?: EntityPlayer | null;
	/** A stock scenario to idle in, e.g. WORLD_HUMAN_STAND_IMPATIENT. The bottom of the brain's stack. */
	scenario?: string;
	/** The rest of the post: a chair, a clip, a home to walk back to. */
	idle?: IdleParams;
	/** Ignore gunfire and never flee. Not invincibility: a ped that holds its post can still be killed. */
	holdsPost?: boolean;
	/** Max health and starting health. Stock is 200. */
	health?: number;
	armour?: number;
	canRagdoll?: boolean;
	/** False stops a headshot killing outright. */
	suffersCriticalHits?: boolean;
	/** A relationship group with no weapon and no target. */
	relationshipGroup?: string;
	/** Who the ped answers to: PED_ROLE. Reports from the clients are routed by it. */
	role?: PedRole;
	scriptHostPed?: boolean;
	/** 0 DeleteWhenNotRelevant, 1 DeleteOnOwnerDisconnect, 2 KeepEntity (the default here). */
	orphanMode?: number;
	components?: PedComponents;
}

/** What the ped is: the client-only setup the server describes rather than sets. */
export interface PedConfig {
	alpha?: number;
	frozen?: boolean;
	invincible?: boolean;
	relationshipGroup?: string;
	holdsPost?: boolean;
	health?: number;
	armour?: number;
	canRagdoll?: boolean;
	suffersCriticalHits?: boolean;
	components?: PedComponents;
	/** Load collision around the ped itself, for one put down far from every player. */
	loadCollision?: boolean;
}

class EntityPed extends BaseEntity {
	controller: EntityPlayer | null = null;

	/** Local mirror of the replicated pedConfig: the bag hands back a copy, not the object. */
	private pedConfig: PedConfig = {};

	constructor(handle: number, controller: EntityPlayer | null = null) {
		super(handle);
		this.controller = controller;
	}

	get handle(): number {
		return this.id;
	}

	get exists(): boolean {
		return this.id !== 0 && DoesEntityExist(this.id);
	}

	/** 0 for a moment after creation: a server-created entity is not addressable on that tick. */
	get netId(): number {
		return this.exists ? NetworkGetNetworkIdFromEntity(this.id) : 0;
	}

	get position(): Vector3 {
		const [x, y, z] = GetEntityCoords(this.id);

		return new Vector3(x, y, z);
	}

	set position(position: Vector3Interface) {
		SetEntityCoords(this.id, position.x, position.y, position.z, false, false, false, false);
	}

	get heading(): number {
		return GetEntityHeading(this.id);
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

	/**
	 * Merged and written as ONE key: bags replicate a whole key, so two writes would briefly
	 * publish a ped that is tough but mortal.
	 */
	configure(config: PedConfig): void {
		this.pedConfig = { ...this.pedConfig, ...config };
		Entity(this.id).state.set('pedConfig', this.pedConfig, true);
	}

	setInvincible(state = true): void {
		this.configure({ invincible: state });
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

export default EntityPed;

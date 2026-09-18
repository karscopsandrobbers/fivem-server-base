/*
 * Client ped support. The engine streams and syncs server peds itself; what remains here is
 * applying the client-only natives the server cannot call. What a ped IS is its `pedConfig` bag,
 * applied by every client that streams it in. What a ped is DOING is its `brain` bag, performed
 * by the one client that controls it (./brain).
 */
import { EVENTS } from '@shared/events';
import { onPedSeen } from './brain/perception';
import './brain';
import './brain/contagion';
import './brain/anticipation';

export { isServerPed } from './brain/perception';
export { isDown, isDirected } from './brain';

/** What a ped IS. Mirrors the server's PedConfig (entities/PedEntity). */
export interface PedConfig {
	alpha?: number;
	frozen?: boolean;
	invincible?: boolean;
	relationshipGroup?: string;
	/** Stay at the post when the shooting starts: deaf to ambient events, flee behaviours removed. */
	holdsPost?: boolean;
	components?: Array<[number, number, number]>;
	loadCollision?: boolean;
	health?: number;
	armour?: number;
	canRagdoll?: boolean;
	suffersCriticalHits?: boolean;
}

const noBagFilter = null as unknown as string;

/*
 * A ped created by the server has no room assigned to it. Outdoors that costs nothing, but inside
 * an MLO every room is culled separately, so it renders from the doorway and vanishes inside.
 */
const roomAssigned = new Set<number>();

const pinToInterior = (entity: number): void => {
	if(roomAssigned.has(entity) || !DoesEntityExist(entity)) {
		return;
	}

	const [x, y, z] = GetEntityCoords(entity, false);
	const interior = GetInteriorAtCoords(x, y, z);

	if(interior === 0) {
		roomAssigned.add(entity);
		return;
	}
	LoadInterior(interior);

	const room = GetRoomKeyFromEntity(entity);

	if(room !== 0) {
		ForceRoomForEntity(entity, interior, room);
		roomAssigned.add(entity);
	}
};

/** Apply a pedConfig to a ped: the client-only natives the server cannot call itself. */
const applyPedConfig = (entity: number, value: PedConfig): void => {
	pinToInterior(entity);

	if(typeof value.alpha === 'number') {
		SetEntityAlpha(entity, value.alpha, false);
	}
	if(typeof value.frozen === 'boolean') {
		FreezeEntityPosition(entity, value.frozen);
	}
	if(typeof value.invincible === 'boolean') {
		SetEntityInvincible(entity, value.invincible);
	}
	if(typeof value.relationshipGroup === 'string' && value.relationshipGroup.length) {
		AddRelationshipGroup(value.relationshipGroup);
		SetPedRelationshipGroupHash(entity, GetHashKey(value.relationshipGroup));
	}
	// Never on a body: a config re-applied to a dead ped would stand it back up.
	if(typeof value.health === 'number' && !IsEntityDead(entity)) {
		// Ceiling before value: SetEntityHealth clamps to the current maximum.
		SetPedMaxHealth(entity, value.health);
		SetEntityHealth(entity, value.health);
	}
	if(typeof value.armour === 'number' && !IsEntityDead(entity)) {
		SetPedArmour(entity, value.armour);
	}
	if(typeof value.canRagdoll === 'boolean') {
		SetPedCanRagdoll(entity, value.canRagdoll);
	}
	if(Array.isArray(value.components)) {
		for(const [component, drawable, texture] of value.components) {
			SetPedComponentVariation(entity, component, drawable, texture, 0);
		}
	}
	if(value.loadCollision === true) {
		SetEntityLoadCollisionFlag(entity, true);
	}
	if(typeof value.suffersCriticalHits === 'boolean') {
		SetPedSuffersCriticalHits(entity, value.suffersCriticalHits);
	}
	if(value.holdsPost === true) {
		SetBlockingOfNonTemporaryEvents(entity, true);
		SetPedFleeAttributes(entity, 0, false);
		// Keeps the floor loaded under him while his owner is far off.
		SetEntityLoadCollisionFlag(entity, true);
		SetPedCanRagdollFromPlayerImpact(entity, false);
	}
};

const configured = new Set<number>();
const noConfigSince = new Map<number, number>();
const NO_CONFIG_RECHECK_MS = 5000;

AddStateBagChangeHandler('pedConfig', noBagFilter, (bagName: string, _key: string, value: PedConfig | null) => {
	if(!value || typeof value !== 'object') {
		return;
	}

	const entity = GetEntityFromStateBagName(bagName);

	if(entity === 0 || !DoesEntityExist(entity) || !IsEntityAPed(entity)) {
		// Not reachable yet. The perception pass picks it up once it streams in.
		return;
	}
	configured.add(entity);
	applyPedConfig(entity, value);
});

/*
 * A state bag handler fires on CHANGE, and a ped's config is written once, at boot. A client that
 * streams the ped in later never sees that write, so the perception pass configures what the
 * handler could not deliver.
 */
onPedSeen(ped => {
	if(configured.has(ped) || IsPedAPlayer(ped)) {
		return;
	}

	const now = GetGameTimer();

	if(now - (noConfigSince.get(ped) ?? -Infinity) < NO_CONFIG_RECHECK_MS) {
		return;
	}

	const value = Entity(ped).state.pedConfig as PedConfig | undefined;

	if(value && typeof value === 'object') {
		noConfigSince.delete(ped);
		configured.add(ped);
		applyPedConfig(ped, value);
		return;
	}
	noConfigSince.set(ped, now);
});

// Handles are recycled, so a stale entry would stop a NEW ped ever being configured.
setInterval(() => {
	for(const ped of [...configured]) {
		if(!DoesEntityExist(ped)) {
			configured.delete(ped);
			roomAssigned.delete(ped);
		}
	}
	for(const [ped, at] of noConfigSince) {
		if(GetGameTimer() - at >= NO_CONFIG_RECHECK_MS) {
			noConfigSince.delete(ped);
		}
	}
}, 5000);

/*
 * A hit this client landed on a server ped is a threat the server hears about, the same way a gun
 * on one is: the ped's role decides what it does about it. The server has no ped-damage event.
 */
const hitSaidAt = new Map<number, number>();
const HIT_REPEAT_MS = 2000;

on('gameEventTriggered', (name: string, args: number[]) => {
	if(name !== 'CEventNetworkEntityDamage') {
		return;
	}

	const [victim, culprit] = args;
	const self = PlayerPedId();

	if(!victim || victim === self || !DoesEntityExist(victim) || !IsEntityAPed(victim) || !NetworkGetEntityIsNetworked(victim)) {
		return;
	}

	const ownVehicle = GetVehiclePedIsIn(self, false);
	const mine = culprit === self || (ownVehicle !== 0 && culprit === ownVehicle) || HasEntityBeenDamagedByEntity(victim, self, true);

	if(!mine || GetGameTimer() < (hitSaidAt.get(victim) ?? 0)) {
		return;
	}
	hitSaidAt.set(victim, GetGameTimer() + HIT_REPEAT_MS);
	emitNet(EVENTS.SERVER_PED_AIMED_AT, NetworkGetNetworkIdFromEntity(victim));
	ClearEntityLastDamageEntity(victim);
});

/*
 * The one look around: every ped near the player, once a second, for every system that needs to
 * pick one. The same pass carries the bag adopters, for a ped whose state was written before
 * this client could see it.
 */
import { BRAIN } from '@shared/peds/pedBrain';

export interface PedSnapshot {
	ped: number;
	/** 0 for a ped that is not networked, which is nothing the server could ever be told about. */
	netId: number;
	model: number;
	x: number;
	y: number;
	z: number;
	distance: number;
	interior: number;
	isPlayer: boolean;
	/** One the server placed. Never a bystander. */
	isServer: boolean;
	isAnimal: boolean;
	inVehicle: boolean;
	dead: boolean;
	/** This client controls it, so this client may task it. */
	mine: boolean;
}

/** Is this ped one the SERVER placed? Anything with a pedConfig is ours and has a job. */
export const isServerPed = (ped: number): boolean => {
	try {
		const config = Entity(ped).state.pedConfig;

		// typeof null is 'object' too, and an absent bag answers null.
		return config !== null && config !== undefined;
	} catch{
		return false;
	}
};

/** Armed or fighting: the peds a drawn weapon tells nothing new, which the flinch reflexes leave alone. */
export const isArmedOrHostile = (ped: number): boolean => IsPedArmed(ped, 7) || IsPedInCombat(ped, PlayerPedId());

const hooks: Array<(ped: number) => void> = [];

/** Called for every ped in the pool on every pass, in scope or not. */
export const onPedSeen = (hook: (ped: number) => void): void => {
	hooks.push(hook);
};

let snapshot: PedSnapshot[] = [];

export const scanNow = (): PedSnapshot[] => {
	const me = PlayerPedId();
	const [px, py, pz] = GetEntityCoords(me, true);
	const out: PedSnapshot[] = [];

	for(const ped of GetGamePool('CPed') as number[]) {
		if(ped === me || !DoesEntityExist(ped)) {
			continue;
		}
		for(const hook of hooks) {
			hook(ped);
		}

		const [x, y, z] = GetEntityCoords(ped, false);
		const distance = Vdist(px, py, pz, x, y, z);

		if(distance > BRAIN.PERCEPTION_RANGE) {
			continue;
		}

		const isPlayer = IsPedAPlayer(ped);

		out.push({
			ped,
			netId: NetworkGetEntityIsNetworked(ped) ? NetworkGetNetworkIdFromEntity(ped) : 0,
			model: GetEntityModel(ped) >>> 0,
			x,
			y,
			z,
			distance,
			interior: GetInteriorFromEntity(ped),
			isPlayer,
			isServer: !isPlayer && isServerPed(ped),
			isAnimal: !isPlayer && !IsPedHuman(ped),
			inVehicle: IsPedInAnyVehicle(ped, false),
			dead: IsPedDeadOrDying(ped, true),
			mine: NetworkHasControlOfEntity(ped),
		});
	}
	snapshot = out;
	return out;
};

/** The last pass, as it was. */
export const nearbyPeds = (): PedSnapshot[] => snapshot;

/** The game's own PEOPLE: alive, on foot, not a player, not the server's, not an animal. */
export const ambientPeople = (list: PedSnapshot[] = snapshot): PedSnapshot[] => (
	list.filter(entry => !entry.isPlayer && !entry.isServer && !entry.isAnimal && !entry.dead && !entry.inVehicle)
);

setInterval(scanNow, BRAIN.PERCEPTION_MS);

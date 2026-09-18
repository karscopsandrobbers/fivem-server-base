/*
 * The spawn routine, in the order the official spawnmanager does it: fade out, freeze, model,
 * collision, resurrect, fade in. ShutdownLoadingScreenNui alone does not dismiss the native
 * "awaiting scripts" screen; ShutdownLoadingScreen is needed as well.
 */
import { EVENTS } from '@shared/events';
import { Delay, localPlayer } from './player/nativeHooks';

interface SpawnRequest {
	x: number;
	y: number;
	z: number;
	heading: number;
	model?: string | number;
}

const DEFAULT_MODEL = 'mp_m_freemode_01';
const MODEL_LOAD_TIMEOUT_MS = 5000;
const COLLISION_TIMEOUT_MS = 5000;

export const setPedModel = async (model: string | number): Promise<boolean> => {
	const hash = typeof model === 'number' ? model : GetHashKey(model);

	if(!IsModelInCdimage(hash) || !IsModelValid(hash)) {
		return false;
	}
	RequestModel(hash);

	const start = GetGameTimer();

	while(!HasModelLoaded(hash)) {
		if(GetGameTimer() - start > MODEL_LOAD_TIMEOUT_MS) {
			return false;
		}
		await Delay(50);
	}
	SetPlayerModel(localPlayer.id, hash);
	SetModelAsNoLongerNeeded(hash);
	// Freemode models ship with no clothing components applied and render invisible until they do.
	SetPedDefaultComponentVariation(PlayerPedId());
	return true;
};

const freeze = (frozen: boolean): void => {
	const ped = PlayerPedId();

	// SPC_ALLOW_PLAYER_DAMAGE: without it SET_PLAYER_CONTROL(false) leaves the player invulnerable.
	SetPlayerControl(localPlayer.id, !frozen, frozen ? 1 << 9 : 0);
	SetEntityVisible(ped, !frozen, false);
	SetEntityCollision(ped, !frozen, true);
	FreezeEntityPosition(ped, frozen);
	SetPlayerInvincible(localPlayer.id, frozen);
	if(frozen && !IsPedFatallyInjured(ped)) {
		ClearPedTasksImmediately(ped);
	}
};

let spawning = false;

export const spawnPlayer = async (spawn: SpawnRequest): Promise<void> => {
	if(spawning) {
		return;
	}
	spawning = true;

	try {
		DoScreenFadeOut(500);
		while(!IsScreenFadedOut()) {
			await Delay(0);
		}
		freeze(true);
		await setPedModel(spawn.model ?? DEFAULT_MODEL);

		const ped = PlayerPedId();

		RequestCollisionAtCoord(spawn.x, spawn.y, spawn.z);
		SetEntityCoordsNoOffset(ped, spawn.x, spawn.y, spawn.z, false, false, false);
		NetworkResurrectLocalPlayer(spawn.x, spawn.y, spawn.z, spawn.heading, 0, true);
		ClearPedTasksImmediately(ped);
		RemoveAllPedWeapons(ped, false);
		ClearPlayerWantedLevel(localPlayer.id);

		const collisionStart = GetGameTimer();

		while(!HasCollisionLoadedAroundEntity(ped) && GetGameTimer() - collisionStart < COLLISION_TIMEOUT_MS) {
			await Delay(0);
		}
		ShutdownLoadingScreen();
		ShutdownLoadingScreenNui();

		if(IsScreenFadedOut()) {
			DoScreenFadeIn(500);
			while(!IsScreenFadedIn()) {
				await Delay(0);
			}
		}
		emitNet(EVENTS.PLAYER_SPAWNED);
	} finally {
		// In the finally: a spawn that throws must not leave the player frozen and invincible.
		freeze(false);
		spawning = false;
	}
};

onNet(EVENTS.PLAYER_SPAWN, (spawn: SpawnRequest) => {
	if(spawn && typeof spawn.x === 'number') {
		void spawnPlayer(spawn);
	}
});

// The session is up: ask the server for a spawn. Nothing happens until it answers.
void (async (): Promise<void> => {
	while(!NetworkIsSessionStarted()) {
		await Delay(100);
	}
	emitNet(EVENTS.PLAYER_READY);
})();

// Death is only visible from here: the server has no ped-death event of its own.
let reportedDead = false;

setInterval(() => {
	const dead = IsPedDeadOrDying(PlayerPedId(), true);

	if(dead && !reportedDead) {
		reportedDead = true;
		emitNet(EVENTS.PLAYER_DIED);
	} else if(!dead) {
		reportedDead = false;
	}
}, 500);

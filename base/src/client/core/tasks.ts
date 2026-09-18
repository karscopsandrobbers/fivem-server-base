/*
 * The task relay: the server names an entity by net id and a client-only native to run on it,
 * and every client runs it. That is how anything FiveM does not sync on its own (animations,
 * particles, attachments, weapons) reaches every screen.
 */
import { EVENTS } from '@shared/events';
import { TASKS, TaskRequest } from '@shared/tasks';
import { Delay } from './player/nativeHooks';
import { loadAnimationDict, loadPtfxAsset } from '../modules/utils';

const MAX_ASSET_WAIT_MS = 5000;
/** A vehicle created this tick can take a while to reach this client. */
const ENTER_VEHICLE_WAIT_MS = 10000;
/** How long the warp gets to happen on its own before the ped is seated by hand. */
const WARP_SETTLE_MS = 1500;
const WARP_INTO_SEAT = 16;

/** Net ids are global; entity handles are per-machine, so always resolve one into the other here. */
const entityFromNetId = (netId: number): number => {
	if(!netId || !NetworkDoesNetworkIdExist(netId)) {
		return 0;
	}
	return NetworkGetEntityFromNetworkId(netId);
};

/** A server-created entity resolves here only once it has streamed into this client's scope. */
const waitForNetEntity = async (netId: number, timeoutMs = MAX_ASSET_WAIT_MS): Promise<number> => {
	const start = GetGameTimer();

	for(;;) {
		const entity = entityFromNetId(netId);

		if(entity && DoesEntityExist(entity)) {
			return entity;
		}
		if(GetGameTimer() - start > timeoutMs) {
			return 0;
		}
		await Delay(50);
	}
};

/** TaskEnterVehicle with the warp flag declines quietly while the vehicle is still arriving; seat them outright after a moment. */
const seatOrWarp = async (ped: number, vehicle: number, seat: number): Promise<void> => {
	const deadline = GetGameTimer() + WARP_SETTLE_MS;

	while(GetGameTimer() < deadline) {
		if(GetVehiclePedIsIn(ped, false) === vehicle) {
			return;
		}
		await Delay(100);
	}
	if(!DoesEntityExist(ped) || !DoesEntityExist(vehicle) || GetVehiclePedIsIn(ped, false) === vehicle) {
		return;
	}
	if(!NetworkHasControlOfEntity(vehicle)) {
		NetworkRequestControlOfEntity(vehicle);
		await Delay(100);
	}
	SetPedIntoVehicle(ped, vehicle, seat);
};

const runTask = async (request: TaskRequest): Promise<void> => {
	const entity = entityFromNetId(request.netId);

	if(!entity || !DoesEntityExist(entity)) {
		return;
	}

	const args = request.args as any[];

	switch(request.name) {
		case TASKS.PLAY_ANIM: {
			const [dict, anim, blendIn, blendOut, duration, flag, rate, lockX, lockY, lockZ] = args;

			if(await loadAnimationDict(dict)) {
				TaskPlayAnim(entity, dict, anim, blendIn, blendOut, duration, flag, rate, lockX, lockY, lockZ);
			}
			break;
		}
		case TASKS.PLAY_ANIM_ADVANCED: {
			const [dict, anim, px, py, pz, rx, ry, rz, blendIn, blendOut, duration, flag, animTime] = args;

			if(await loadAnimationDict(dict)) {
				TaskPlayAnimAdvanced(entity, dict, anim, px, py, pz, rx, ry, rz, blendIn, blendOut, duration, flag, animTime, 0, 0);
			}
			break;
		}
		case TASKS.PLAY_ENTITY_ANIM: {
			const [dict, anim, blendIn, loop, holdLastFrame] = args;

			if(await loadAnimationDict(dict)) {
				PlayEntityAnim(entity, anim, dict, blendIn, loop, holdLastFrame, false, 0.0, 0);
			}
			break;
		}
		case TASKS.STOP_ANIM: {
			const [dict, anim, exitSpeed] = args;

			StopAnimTask(entity, dict, anim, exitSpeed);
			break;
		}
		case TASKS.FACIAL_ANIM: {
			const [anim, dict] = args;

			PlayFacialAnim(entity, anim, dict);
			break;
		}
		case TASKS.SCENARIO_IN_PLACE: {
			const [scenario, timeToLeave, playIntro] = args;

			TaskStartScenarioInPlace(entity, scenario, timeToLeave, playIntro);
			break;
		}
		case TASKS.SCENARIO_AT_POSITION: {
			const [scenario, x, y, z, heading, timeToLeave, playIntro, warp] = args;

			TaskStartScenarioAtPosition(entity, scenario, x, y, z, heading, timeToLeave, playIntro, warp);
			break;
		}
		case TASKS.GO_STRAIGHT_TO_COORD: {
			const [x, y, z, speed, timeout, targetHeading, slideDistance] = args;

			TaskGoStraightToCoord(entity, x, y, z, speed, timeout, targetHeading, slideDistance);
			break;
		}
		case TASKS.TURN_TO_FACE_ENTITY: {
			const [targetNetId, duration] = args;
			const target = entityFromNetId(targetNetId);

			if(target) {
				TaskTurnPedToFaceEntity(entity, target, duration);
			}
			break;
		}
		case TASKS.TURN_TO_FACE_COORD: {
			const [x, y, z, duration] = args;

			TaskTurnPedToFaceCoord(entity, x, y, z, duration);
			break;
		}
		case TASKS.AIM_GUN_AT_ENTITY: {
			const [targetNetId, duration] = args;
			const target = entityFromNetId(targetNetId);

			if(target) {
				TaskAimGunAtEntity(entity, target, duration, false);
			}
			break;
		}
		case TASKS.HANDS_UP: {
			const [duration, facingNetId] = args;
			const facing = facingNetId ? entityFromNetId(facingNetId) : 0;

			TaskHandsUp(entity, duration, facing || -1, 1, false);
			break;
		}
		case TASKS.ENTER_VEHICLE: {
			const [vehicleNetId, timeout, seat, speed, flag] = args;
			const vehicle = await waitForNetEntity(vehicleNetId, ENTER_VEHICLE_WAIT_MS);

			if(!vehicle || !DoesEntityExist(entity)) {
				break;
			}
			TaskEnterVehicle(entity, vehicle, timeout, seat, speed, flag, 0);
			if((flag & WARP_INTO_SEAT) !== 0) {
				await seatOrWarp(entity, vehicle, seat);
			}
			break;
		}
		case TASKS.LEAVE_VEHICLE: {
			const [vehicleNetId, flags] = args;
			const vehicle = entityFromNetId(vehicleNetId);

			if(vehicle) {
				TaskLeaveVehicle(entity, vehicle, flags);
			}
			break;
		}
		case TASKS.CLEAR_TASKS:
			ClearPedTasks(entity);
			break;
		case TASKS.CLEAR_TASKS_IMMEDIATELY:
			ClearPedTasksImmediately(entity);
			break;
		case TASKS.PTFX_AT_COORD: {
			const [asset, effect, x, y, z, scale] = args;

			if(await loadPtfxAsset(asset)) {
				UseParticleFxAsset(asset);
				StartParticleFxNonLoopedAtCoord(effect, x, y, z, 0.0, 0.0, 0.0, scale, false, false, false);
			}
			break;
		}
		case TASKS.PTFX_ON_ENTITY: {
			const [asset, effect, scale, offsetZ] = args;

			if(await loadPtfxAsset(asset)) {
				UseParticleFxAsset(asset);
				StartParticleFxNonLoopedOnEntity(effect, entity, 0.0, 0.0, offsetZ, 0.0, 0.0, 0.0, scale, false, false, false);
			}
			break;
		}
		case TASKS.PLAY_SOUND_FROM_ENTITY: {
			const [audioName, audioRef] = args;

			PlaySoundFromEntity(-1, audioName, entity, audioRef, false, 0);
			break;
		}
		case TASKS.ATTACH_TO: {
			const [targetNetId, boneId, x, y, z, rx, ry, rz] = args;
			const target = entityFromNetId(targetNetId);

			if(target) {
				AttachEntityToEntity(entity, target, boneId ? GetPedBoneIndex(target, boneId) : 0, x, y, z, rx, ry, rz, false, false, false, true, 2, true);
			}
			break;
		}
		case TASKS.DETACH:
			if(IsEntityAttached(entity)) {
				DetachEntity(entity, true, true);
			}
			break;
		case TASKS.REPAIR_VEHICLE:
			SetVehicleFixed(entity);
			SetVehicleDeformationFixed(entity);
			SetVehicleEngineHealth(entity, 1000.0);
			SetVehicleBodyHealth(entity, 1000.0);
			SetVehiclePetrolTankHealth(entity, 1000.0);
			break;
		case TASKS.FLIP_VEHICLE: {
			const [fx, fy, fz] = GetEntityCoords(entity, true);

			SetEntityCoordsNoOffset(entity, fx, fy, fz + 1.0, true, true, true);
			SetEntityRotation(entity, 0.0, 0.0, GetEntityHeading(entity), 2, true);
			SetVehicleOnGroundProperly(entity);
			break;
		}
		case TASKS.SET_ARMOUR:
			SetPedArmour(entity, args[0]);
			break;
		case TASKS.SET_HEALTH:
			SetEntityHealth(entity, args[0] as number);
			break;
		case TASKS.REMOVE_ALL_WEAPONS:
			RemoveAllPedWeapons(entity, true);
			break;
		case TASKS.GIVE_WEAPON: {
			const [weapon, ammo, equip] = args;

			// Only the ped's own client may give it a weapon.
			if(NetworkHasControlOfEntity(entity)) {
				GiveWeaponToPed(entity, GetHashKey(weapon), ammo ?? 250, false, equip !== false);
			}
			break;
		}
		case TASKS.LOAD_IPL:
			if(typeof args[0] === 'string' && !IsIplActive(args[0])) {
				RequestIpl(args[0]);
			}
			break;
		case TASKS.REMOVE_IPL:
			if(typeof args[0] === 'string' && IsIplActive(args[0])) {
				RemoveIpl(args[0]);
			}
			break;
	}
};

onNet(EVENTS.TASK_RUN, (request: TaskRequest) => {
	if(!request || typeof request.netId !== 'number' || typeof request.name !== 'string' || !Array.isArray(request.args)) {
		return;
	}
	void runTask(request);
});

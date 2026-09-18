/*
 * Client helpers: streaming loaders, raycasts, and the odd native wrapper. Every loader is async
 * and has to be awaited; the client cannot block the script thread.
 */
import { angleClamp360, xyInFrontOfPos } from '@shared/index';
import { Vector3 } from '@shared/math/Vector3';

export interface Vec3Like {
	x: number;
	y: number;
	z: number;
}

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** How long a streaming request may take before it is given up on. */
const MAX_ASSET_WAIT_MS = 5000;

const waitForAsset = async (loaded: () => boolean): Promise<boolean> => {
	const start = GetGameTimer();

	while(!loaded()) {
		if(GetGameTimer() - start > MAX_ASSET_WAIT_MS) {
			return false;
		}
		await wait(10);
	}
	return true;
};

export const sleep = wait;

// ─── streaming ─────────────────────────────────────────────────────────────

export const loadAnimationDict = async (dict: string): Promise<boolean> => {
	if(HasAnimDictLoaded(dict)) {
		return true;
	}
	RequestAnimDict(dict);
	return waitForAsset(() => HasAnimDictLoaded(dict));
};

export const loadClipSet = async (clipSet: string): Promise<boolean> => {
	if(HasClipSetLoaded(clipSet)) {
		return true;
	}
	RequestClipSet(clipSet);
	return waitForAsset(() => HasClipSetLoaded(clipSet));
};

export const loadPtfxAsset = async (asset: string): Promise<boolean> => {
	if(HasNamedPtfxAssetLoaded(asset)) {
		return true;
	}
	RequestNamedPtfxAsset(asset);
	return waitForAsset(() => HasNamedPtfxAssetLoaded(asset));
};

export const loadModel = async (model: number): Promise<boolean> => {
	if(HasModelLoaded(model)) {
		return true;
	}
	RequestModel(model);
	return waitForAsset(() => HasModelLoaded(model));
};

export const loadTextureDictionary = async (dict: string): Promise<boolean> => {
	if(HasStreamedTextureDictLoaded(dict)) {
		return true;
	}
	RequestStreamedTextureDict(dict, true);
	return waitForAsset(() => HasStreamedTextureDictLoaded(dict));
};

// ─── geometry ──────────────────────────────────────────────────────────────

export { xyInFrontOfPos, angleClamp360 };

export const getDistanceBetweenPositions = (a: Vec3Like, b: Vec3Like): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const getPlayerPosition = (): Vec3Like => {
	const [x, y, z] = GetEntityCoords(PlayerPedId(), true);

	return { x, y, z };
};

// ─── raycasting ────────────────────────────────────────────────────────────

export interface Raycast {
	position: Vec3Like;
	entity: number;
	surfaceNormal: Vec3Like;
}

/** Flags: 1 map, 2 vehicles, 4 and 8 peds, 16 objects. */
export const doRaycast = (start: Vec3Like, end: Vec3Like, ignoreEntity: number | null = null, flags: number = (1 | 16)): Raycast | undefined => {
	const ray = StartShapeTestRay(start.x, start.y, start.z, end.x, end.y, end.z, flags, ignoreEntity ?? 0, 0);
	const [, hit, endCoords, surfaceNormal, entity] = GetShapeTestResult(ray);

	if(!hit) {
		return undefined;
	}
	return {
		position: { x: endCoords[0], y: endCoords[1], z: endCoords[2] },
		entity,
		surfaceNormal: { x: surfaceNormal[0], y: surfaceNormal[1], z: surfaceNormal[2] },
	};
};

/** What the gameplay camera is pointing at, `distance` metres out. */
export const getPointingAt = (distance = 3.0, ignoreEntity: number | null = null, flags: number = (1 | 16)): Raycast | undefined => {
	const [px, py, pz] = GetGameplayCamCoord();
	const [rotX, , rotZ] = GetGameplayCamRot(2);
	const radZ = rotZ * (Math.PI / 180.0);
	const radX = rotX * (Math.PI / 180.0);
	const num = Math.abs(Math.cos(radX));
	const direction = { x: -Math.sin(radZ) * num, y: Math.cos(radZ) * num, z: Math.sin(radX) };

	return doRaycast({ x: px, y: py, z: pz }, new Vector3((direction.x * distance) + px, (direction.y * distance) + py, (direction.z * distance) + pz), ignoreEntity, flags);
};

/** The entity straight in front of the local ped, or null. */
export const getEntityInFront = (distance = 1.0, flags: number = (4 | 8)): number | null => {
	const ped = PlayerPedId();
	const [sx, sy, sz] = GetOffsetFromEntityInWorldCoords(ped, 0.0, 0.0, -0.3);
	const start = { x: sx, y: sy, z: sz };
	const end = xyInFrontOfPos(start, GetEntityHeading(ped), distance);
	const raycast = doRaycast(start, end, ped, flags);

	return raycast?.entity ? raycast.entity : null;
};

// ─── world ─────────────────────────────────────────────────────────────────

/** [zone, street] at a position, as the map names them. */
export const getLocationInformation = (position: Vec3Like): [string, string] => {
	const [streetNameHash, crossingRoadHash] = GetStreetNameAtCoord(position.x, position.y, position.z);
	const zoneName = GetLabelText(GetNameOfZone(position.x, position.y, position.z));
	let streetName = GetStreetNameFromHashKey(streetNameHash);

	if(crossingRoadHash && crossingRoadHash !== streetNameHash) {
		const crossingRoadName = GetStreetNameFromHashKey(crossingRoadHash);

		if(crossingRoadName !== streetName) {
			streetName += ` / ${crossingRoadName}`;
		}
	}
	return [zoneName, streetName];
};

// ─── controls ──────────────────────────────────────────────────────────────

/**
 * The key a control is bound to, as text. GET_CONTROL_INSTRUCTIONAL_BUTTON answers with the
 * scaleform glyph token ('t_E'); the prefix comes off for drawn text.
 */
export const getControlName = (control: number, inputGroup = 2): string => (
	GetControlInstructionalButton(inputGroup, control, true).replace(/^[tb]_/, '')
);

export const disableControlActionSet = (controls: number[], disable: boolean): void => {
	for(const control of controls) {
		DisableControlAction(0, control, disable);
	}
};

// ─── entities ──────────────────────────────────────────────────────────────

export const getModelHashSafe = (model: number | string): number => (typeof model === 'number' ? model : GetHashKey(model));

/** Take control of a networked entity, so tasks given to it apply. Only one client succeeds, which is correct. */
export const takeControl = async (entity: number): Promise<boolean> => {
	if(!NetworkGetEntityIsNetworked(entity) || NetworkHasControlOfEntity(entity)) {
		return true;
	}
	for(let attempt = 0; attempt < 20; attempt++) {
		NetworkRequestControlOfEntity(entity);
		if(NetworkHasControlOfEntity(entity)) {
			return true;
		}
		await wait(25);
	}
	return false;
};

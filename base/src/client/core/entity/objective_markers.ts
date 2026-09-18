/*
 * Objective markers: the server writes `objective_marker` on an entity's state bag; this tracks
 * which entities have one and draws a floating marker above them while they are on screen.
 * `drawObjectiveMarkerAt` is the same marker at a bare position, for a caller with no entity.
 */
import { localPlayer } from '../player/nativeHooks';
import { createGatedTick } from '../lifecycle';
import { debugging } from '../debug';

export interface ObjectiveMarkerData {
	rotation: { x: number; y: number; z: number };
	scale: { x: number; y: number; z: number };
	colourRgba: [number, number, number, number];
	bobUpAndDown: boolean;
	/** Absolute epoch ms the marker dies at; 0 means it never expires on its own. */
	timeMs: number;
	heightOffset?: number;
}

// The bag filter is an exact bag-name match, so an entity marker has to watch every bag.
const NO_BAG_FILTER = null as unknown as string;

const markerNetIds = new Set<number>();
/** netId -> when it first went out of scope, so a deleted entity cannot sit in the set forever. */
const missingSince = new Map<number, number>();
const MISSING_TIMEOUT_MS = 60000;

const forget = (netId: number): void => {
	markerNetIds.delete(netId);
	missingSince.delete(netId);
};

export const drawObjectiveMarkerAt = (position: { x: number; y: number; z: number }, data: ObjectiveMarkerData): void => {
	DrawMarker(
		2,
		position.x, position.y, position.z,
		0.0, 0.0, 0.0,
		data.rotation.x, data.rotation.y, data.rotation.z,
		data.scale.x, data.scale.y, data.scale.z,
		data.colourRgba[0], data.colourRgba[1], data.colourRgba[2], data.colourRgba[3],
		Boolean(data.bobUpAndDown), true, 2,
		false, null as unknown as string, null as unknown as string, false,
	);
};

AddStateBagChangeHandler('objective_marker', NO_BAG_FILTER, (bagName: string, _key: string, value: unknown) => {
	if(!bagName.startsWith('entity:')) {
		return;
	}

	const netId = Number(bagName.slice('entity:'.length));

	if(!Number.isFinite(netId)) {
		return;
	}
	if(value) {
		markerNetIds.add(netId);
	} else {
		forget(netId);
	}
	if(debugging('objectiveMarkers')) {
		console.log(`[objective_marker]: netId ${netId} ${value ? 'set' : 'cleared'}; tracking ${markerNetIds.size}.`);
	}
});

createGatedTick(() => localPlayer.isSpawned() && markerNetIds.size > 0, () => {
	for(const netId of [...markerNetIds]) {
		// The id check first: it is the quiet one, the entity check logs for an id out of scope.
		if(!NetworkDoesNetworkIdExist(netId) || !NetworkDoesEntityExistWithNetworkId(netId)) {
			const since = missingSince.get(netId) ?? Date.now();

			missingSince.set(netId, since);
			if(Date.now() - since > MISSING_TIMEOUT_MS) {
				forget(netId);
			}
			continue;
		}
		missingSince.delete(netId);

		const entity = NetworkGetEntityFromNetworkId(netId);
		const data = Entity(entity).state.objective_marker as ObjectiveMarkerData | null;

		if(!data || (data.timeMs > 0 && data.timeMs < Date.now())) {
			forget(netId);
			continue;
		}
		if(!IsEntityOnScreen(entity)) {
			continue;
		}

		const [x, y, z] = GetEntityCoords(entity, true);
		const [minimum, maximum] = GetModelDimensions(GetEntityModel(entity));
		const yLength = (0 - minimum[1]) + (maximum[1]) * 0.5;

		drawObjectiveMarkerAt({ x, y, z: z + yLength + (data.heightOffset ?? 0) }, data);
	}
});

/*
 * The server's blips, markers and labels, drawn here. All three ride GlobalState (server
 * core/world), so a list that replicated before this resource loaded is read back on start, and
 * a change replaces the lot: the renderer diffs by id, so an unchanged list costs nothing.
 */
import { drawTextFromWorld } from '../../gui';
import { localPlayer } from '../player/nativeHooks';
import { onResourceStop } from '../lifecycle';

interface Vec3 {
	x: number;
	y: number;
	z: number;
}

interface WorldBlip {
	id: number;
	name: string;
	sprite: number;
	position: Vec3;
	scale: number;
	colour: number;
	shortRange: boolean;
	dimension: number;
}

interface WorldMarker {
	id: number;
	type: number;
	position: Vec3;
	scale: number;
	rotation: number;
	colour: [number, number, number, number];
	bobUpAndDown: boolean;
	dimension: number;
}

interface WorldLabel {
	id: number;
	text: string;
	position: Vec3;
	colour: [number, number, number, number];
	drawDistance: number;
	dimension: number;
	font: number;
}

const MARKER_DRAW_RANGE = 60.0;
/** The near lists are rebuilt this often; the frame walks only them. */
const NEAR_MS = 250;
const NEAR_MARGIN = 1.5;

// ── blips ─────────────────────────────────────────────────────────────────────

const blipHandles = new Map<number, number>();

const nameBlip = (handle: number, name: string): void => {
	BeginTextCommandSetBlipName('STRING');
	AddTextComponentSubstringPlayerName(name);
	EndTextCommandSetBlipName(handle);
};

const renderBlips = (entries: WorldBlip[]): void => {
	const seen = new Set<number>();
	const bucket = localPlayer.dimension;

	for(const entry of entries) {
		if(entry.dimension !== bucket) {
			continue;
		}
		seen.add(entry.id);

		let handle = blipHandles.get(entry.id);

		if(handle !== undefined && !DoesBlipExist(handle)) {
			blipHandles.delete(entry.id);
			handle = undefined;
		}
		if(handle === undefined) {
			handle = AddBlipForCoord(entry.position.x, entry.position.y, entry.position.z);
			blipHandles.set(entry.id, handle);
		} else {
			SetBlipCoords(handle, entry.position.x, entry.position.y, entry.position.z);
		}
		SetBlipSprite(handle, entry.sprite);
		SetBlipScale(handle, entry.scale);
		SetBlipColour(handle, entry.colour);
		SetBlipAsShortRange(handle, entry.shortRange);
		nameBlip(handle, entry.name);
	}
	for(const [id, handle] of [...blipHandles]) {
		if(!seen.has(id)) {
			if(DoesBlipExist(handle)) {
				RemoveBlip(handle);
			}
			blipHandles.delete(id);
		}
	}
};

const readBlips = (): WorldBlip[] => {
	const value = GlobalState.worldBlips as WorldBlip[] | undefined;

	return Array.isArray(value) ? value : [];
};

AddStateBagChangeHandler('worldBlips', 'global', (_bag: string, _key: string, value: unknown) => {
	renderBlips(Array.isArray(value) ? value as WorldBlip[] : []);
});

// The change handler misses the list that replicated before this resource loaded, so poll too.
setInterval(() => renderBlips(readBlips()), 5000);

// ── markers and labels ────────────────────────────────────────────────────────

let markers: WorldMarker[] = [];
let labels: WorldLabel[] = [];
let nearMarkers: WorldMarker[] = [];
let nearLabels: WorldLabel[] = [];

AddStateBagChangeHandler('worldMarkers', 'global', (_bag: string, _key: string, value: unknown) => {
	markers = Array.isArray(value) ? value as WorldMarker[] : [];
});

AddStateBagChangeHandler('worldLabels', 'global', (_bag: string, _key: string, value: unknown) => {
	labels = Array.isArray(value) ? value as WorldLabel[] : [];
});

setInterval(() => {
	const stateMarkers = GlobalState.worldMarkers as WorldMarker[] | undefined;
	const stateLabels = GlobalState.worldLabels as WorldLabel[] | undefined;

	markers = Array.isArray(stateMarkers) ? stateMarkers : [];
	labels = Array.isArray(stateLabels) ? stateLabels : [];
}, 5000);

setInterval(() => {
	if(!markers.length && !labels.length) {
		nearMarkers = [];
		nearLabels = [];
		return;
	}

	const [px, py, pz] = GetEntityCoords(PlayerPedId(), true);
	const bucket = localPlayer.dimension;

	nearMarkers = markers.filter(marker => (
		marker.dimension === bucket
		&& Math.hypot(px - marker.position.x, py - marker.position.y, pz - marker.position.z) <= MARKER_DRAW_RANGE * NEAR_MARGIN
	));
	nearLabels = labels.filter(label => (
		label.dimension === bucket
		&& Math.hypot(px - label.position.x, py - label.position.y, pz - label.position.z) <= label.drawDistance * NEAR_MARGIN
	));
}, NEAR_MS);

setTick(() => {
	if(!nearMarkers.length && !nearLabels.length) {
		return;
	}

	const [px, py, pz] = GetEntityCoords(PlayerPedId(), true);

	for(const marker of nearMarkers) {
		if(Math.hypot(px - marker.position.x, py - marker.position.y, pz - marker.position.z) > MARKER_DRAW_RANGE) {
			continue;
		}
		DrawMarker(
			marker.type, marker.position.x, marker.position.y, marker.position.z,
			0.0, 0.0, 0.0, 0.0, 0.0, marker.rotation,
			marker.scale, marker.scale, marker.scale,
			marker.colour[0], marker.colour[1], marker.colour[2], marker.colour[3],
			marker.bobUpAndDown, false, 2, marker.bobUpAndDown, undefined as unknown as string, undefined as unknown as string, false,
		);
	}
	for(const label of nearLabels) {
		if(Math.hypot(px - label.position.x, py - label.position.y, pz - label.position.z) <= label.drawDistance) {
			drawTextFromWorld(label.text, [label.position.x, label.position.y, label.position.z], label.font, label.colour, 0.5);
		}
	}
});

onResourceStop(() => {
	for(const handle of blipHandles.values()) {
		if(DoesBlipExist(handle)) {
			RemoveBlip(handle);
		}
	}
	blipHandles.clear();
});

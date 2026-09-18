/*
 * A floating marker above any server entity (vehicle, object, ped), written to its state bag and
 * drawn by every client that has it in scope (client/core/entity/objective_markers).
 */
export interface ObjectiveMarkerData {
	rotation: { x: number; y: number; z: number };
	scale: { x: number; y: number; z: number };
	colourRgba: [number, number, number, number];
	bobUpAndDown: boolean;
	/** Lifetime in ms; 0 or less means it never expires on its own. */
	timeMs: number;
}

/** How long a freshly created entity is given to come into existence before the marker is given up. */
const CREATE_SETTLE_ATTEMPTS = 10;
const CREATE_SETTLE_MS = 100;

export const setObjectiveMarker = (entity: number, data: ObjectiveMarkerData, attempt = 0): void => {
	// A server-created entity does not exist on the tick that creates it: a short retry covers it.
	if(!entity || !DoesEntityExist(entity)) {
		if(entity && attempt < CREATE_SETTLE_ATTEMPTS) {
			setTimeout(() => setObjectiveMarker(entity, data, attempt + 1), CREATE_SETTLE_MS);
			return;
		}
		globalThis.mp.logger.warn(`[setObjectiveMarker]: entity ${entity} does not exist.`);
		return;
	}

	const payload: ObjectiveMarkerData = { ...data };

	if(payload.timeMs > 0) {
		// Absolute epoch ms: the client compares against Date.now().
		payload.timeMs += Date.now();
	}
	Entity(entity).state.set('objective_marker', payload, true);
};

export const removeObjectiveMarker = (entity: number): void => {
	if(entity && DoesEntityExist(entity)) {
		Entity(entity).state.set('objective_marker', null, true);
	}
};

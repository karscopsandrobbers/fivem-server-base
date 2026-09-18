/*
 * E on a vehicle: lock or unlock it. Reach and visibility are measured from the BODYWORK rather
 * than the middle of the car, so a Panto and a Phantom feel the same.
 */
import { EVENTS } from '@shared/events';
import { definePrompt } from '../index';
import { PromptTarget } from '../types';

const REACH_FROM_BODY = 0.9;
const SHOW_FROM_BODY = 2.2;
const SEARCH_RANGE = 14.0;
/** Clear of the roof on an ordinary car. */
const HEIGHT = 1.15;

const interactable = (vehicle: number): boolean => DoesEntityExist(vehicle) && !IsEntityDead(vehicle) && NetworkGetEntityIsNetworked(vehicle);

/** Half the longest side of the model: how far its bodywork reaches from the middle. */
const bodyRadius = (vehicle: number): number => {
	const [min, max] = GetModelDimensions(GetEntityModel(vehicle)) as unknown as [number[], number[]];

	return Math.max(max[0] - min[0], max[1] - min[1]) / 2;
};

definePrompt({
	id: 'vehicle_lock',
	key: 'E',
	label: target => (Entity(target.data as number).state.locked === true ? 'Unlock' : 'Lock'),
	find: (): PromptTarget[] => {
		const [px, py, pz] = GetEntityCoords(PlayerPedId(), true);
		let best = 0;
		let bestDistance = SEARCH_RANGE;

		for(const vehicle of GetGamePool('CVehicle') as number[]) {
			if(!interactable(vehicle)) {
				continue;
			}

			const [vx, vy, vz] = GetEntityCoords(vehicle, false);
			const distance = Vdist(px, py, pz, vx, vy, vz);

			if(distance < bestDistance) {
				bestDistance = distance;
				best = vehicle;
			}
		}
		if(!best) {
			return [];
		}

		const radius = bodyRadius(best);

		return [{
			key: `vehicle:${best}`,
			entity: best,
			offset: { x: 0, y: 0, z: HEIGHT },
			interactDistance: radius + REACH_FROM_BODY,
			drawDistance: radius + SHOW_FROM_BODY,
			data: best,
		}];
	},
	onInteract: target => {
		const vehicle = target.data as number;

		if(DoesEntityExist(vehicle)) {
			emitNet(EVENTS.SERVER_VEHICLE_TOGGLE_LOCK, NetworkGetNetworkIdFromEntity(vehicle));
		}
	},
});

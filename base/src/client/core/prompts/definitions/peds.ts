/*
 * E on a person: the nearest ped on foot within reach who is alive and not a player. The server
 * decides what talking to them means (peds/civilians on the server).
 */
import { EVENTS } from '@shared/events';
import { definePrompt } from '../index';
import { PromptTarget } from '../types';

const SEARCH_RANGE = 8.0;
const REACH = 2.0;
const SHOW = 4.5;
/** Chest height, clear of a nametag over a head. */
const HEIGHT = 0.5;

const eligible = (ped: number, self: number): boolean => (
	ped !== self && DoesEntityExist(ped) && !IsPedAPlayer(ped) && !IsEntityDead(ped)
	&& !IsPedInAnyVehicle(ped, true) && NetworkGetEntityIsNetworked(ped)
);

definePrompt({
	id: 'ped_talk',
	key: 'E',
	label: 'Talk',
	drawDistance: SHOW,
	interactDistance: REACH,
	find: (): PromptTarget[] => {
		const self = PlayerPedId();

		if(IsPedInAnyVehicle(self, false)) {
			return [];
		}

		const [px, py, pz] = GetEntityCoords(self, true);
		let best = 0;
		let bestDistance = SEARCH_RANGE;

		for(const ped of GetGamePool('CPed') as number[]) {
			if(!eligible(ped, self)) {
				continue;
			}

			const [x, y, z] = GetEntityCoords(ped, false);
			const distance = Vdist(px, py, pz, x, y, z);

			if(distance < bestDistance) {
				bestDistance = distance;
				best = ped;
			}
		}
		return best ? [{ key: `ped:${best}`, entity: best, offset: { x: 0, y: 0, z: HEIGHT }, data: best }] : [];
	},
	onInteract: target => {
		const ped = target.data as number;

		if(DoesEntityExist(ped)) {
			emitNet(EVENTS.SERVER_PED_TALK, NetworkGetNetworkIdFromEntity(ped));
		}
	},
});

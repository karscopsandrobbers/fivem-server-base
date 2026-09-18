/*
 * The ped brain's wiring: what the clients send about the peds they perform, and the sweep.
 *
 * A report names a ped by its NET id, is resolved back to a ped the server is already directing,
 * and is only taken from a spawned player close enough to have seen it. `stopped` is taken only
 * from the client performing the act, and `done` and `gone` never come from a client at all.
 */
import { EVENTS } from '@shared/events';
import { BRAIN, PedReport } from '@shared/peds/pedBrain';
import type EntityPlayer from '../../entities/PlayerEntity';
import { pedBrain } from './BrainService';
import type { PedBrain } from './types';

export { pedBrain } from './BrainService';
export type { Activity, PedBrain, RequestOptions } from './types';

/** What a client is allowed to say. `done` is the server's own clock and `gone` its own sweep. */
const CLIENT_REPORTS: readonly PedReport[] = Object.freeze(['dialling', 'stopped', 'fighting', 'dead', 'posted']);
const REPORT_RANGE = BRAIN.PERCEPTION_RANGE;
const AIM_REACH = BRAIN.AIM_RANGE * 1.5;

export const isNearPed = (player: EntityPlayer, handle: number, range: number = REPORT_RANGE): boolean => {
	if(!handle || !DoesEntityExist(handle)) {
		return false;
	}

	const [x, y, z] = GetEntityCoords(handle);
	const at = player.position;

	return Math.hypot(at.x - x, at.y - y, at.z - z) <= range;
};

const brainNear = (player: EntityPlayer, netId: number, range: number): PedBrain | null => {
	const brain = pedBrain.byNetId(netId);

	return brain && isNearPed(player, brain.handle, range) ? brain : null;
};

onNet(EVENTS.SERVER_PED_REPORT, (netId: unknown, report: unknown) => {
	const player = globalThis.mp.players.at(source);

	if(!player?.isSpawned() || typeof netId !== 'number' || typeof report !== 'string' || !CLIENT_REPORTS.includes(report as PedReport)) {
		return;
	}

	const brain = brainNear(player, netId, REPORT_RANGE);

	// Only the client performing the act knows it was interrupted.
	if(!brain || (report === 'stopped' && NetworkGetEntityOwner(brain.handle) !== Number(source))) {
		return;
	}
	pedBrain.report(netId, report as PedReport);
});

onNet(EVENTS.SERVER_PED_AIMED_AT, (netId: unknown) => {
	const player = globalThis.mp.players.at(source);

	if(player?.isSpawned() && typeof netId === 'number' && brainNear(player, netId, AIM_REACH)) {
		pedBrain.aimedAt(player.id, netId);
	}
});

onNet(EVENTS.SERVER_PED_AIM_HELD, (netId: unknown) => {
	const player = globalThis.mp.players.at(source);

	if(player?.isSpawned() && typeof netId === 'number' && brainNear(player, netId, AIM_REACH)) {
		pedBrain.aimHeld(player.id, netId);
	}
});

setInterval(() => pedBrain.sweep(), BRAIN.SWEEP_MS);

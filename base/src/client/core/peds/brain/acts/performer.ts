import type { ActivityKind, BrainView, PedReport } from '@shared/peds/pedBrain';

/** Per-ped working memory for a performer. */
export type Scratch = Record<string, unknown>;

/** One activity, as the controlling client performs it. */
export interface Performer {
	/** Put the act on the ped. False to be asked again next poll, for a clip that is still loading. */
	apply(ped: number, view: BrainView, scratch: Scratch, previous: ActivityKind | null, now: number, unix: number): boolean | Promise<boolean>;
	/** Keep it going, and say what came of it. */
	tick?(ped: number, view: BrainView, scratch: Scratch, now: number, unix: number, me: number): PedReport | null;
	/** Take it off the ped, before the next act goes on. */
	clear?(ped: number, scratch: Scratch): void | Promise<void>;
	/** This client should take control to perform it even when it does not have it: the one being shot at runs the fight. */
	claim?(view: BrainView, me: number, ped: number): boolean;
	/** What to tell the server the moment the act is on. */
	started?: PedReport;
}

export const paramsOf = <T>(view: BrainView): T => view.params as unknown as T;

/** The player ped for a server id, or 0 when that player is not in scope. */
export const playerPedOf = (serverId: number): number => {
	if(!serverId) {
		return 0;
	}

	const player = GetPlayerFromServerId(serverId);

	if(player === -1) {
		return 0;
	}

	const ped = GetPlayerPed(player);

	return ped && DoesEntityExist(ped) ? ped : 0;
};

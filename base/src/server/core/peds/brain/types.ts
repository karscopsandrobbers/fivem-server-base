import type { ActivityKind, PedRole } from '@shared/peds/pedBrain';
import type { PedTraits } from '@shared/peds/pedTraits';

/** One entry on a ped's stack. */
export interface Activity {
	kind: ActivityKind;
	params: Record<string, unknown>;
	target: number;
	at: { x: number; y: number; z: number } | null;
	/** Unix seconds it was asked for, and when it ends on its own. 0 for as long as it is asked. */
	since: number;
	until: number;
	/** Names this entry, so the system that asked can take back exactly what it asked for. */
	token: string;
}

export interface RequestOptions {
	params?: Record<string, unknown>;
	target?: number;
	at?: { x: number; y: number; z: number } | null;
	until?: number;
	token?: string;
}

/** What the server knows about one ped it directs. */
export interface PedBrain {
	handle: number;
	netId: number;
	role: PedRole;
	/** One of the game's own people, taken for a while: gone when it streams out of everybody's range. */
	ambient: boolean;
	/** What sort of person this one is. Rolled from its identity, so it is the same one every time. */
	traits: PedTraits;
	/** The bottom is always idle. The top is what the clients see. */
	stack: Activity[];
	timer: ReturnType<typeof setTimeout> | null;
	/** What was last written to the bag, so a change that changes nothing replicates nothing. */
	published: string;
}

/*
 * Task sequences: a chain of tasks handed to a ped as one job, worked through by the engine.
 *
 *   playSequence(ped, () => {
 *     TaskTurnPedToFaceCoord(SEQUENCE_PED, x, y, z, 1000);
 *     TaskPause(SEQUENCE_PED, 800);
 *     TaskPlayAnim(SEQUENCE_PED, dict, clip, ...);
 *   });
 *
 * Inside the builder every task takes SEQUENCE_PED (0) instead of a real ped. Roughly eight
 * tasks fit in one. A sequence is a slot in a small engine-side pool, so it is always closed
 * and always cleared.
 */
export const SEQUENCE_PED = 0;

// OPEN_SEQUENCE_TASK hands the id back through an out-parameter the JS runtime returns.
const openSequence = OpenSequenceTask as unknown as (id: number) => number;

export interface SequenceOptions {
	repeat?: boolean;
	holdThroughEvents?: boolean;
}

/** False when the engine would not give us a slot, so the caller can fall back to a plain task. */
export const playSequence = (ped: number, build: () => void, options: SequenceOptions = {}): boolean => {
	if(!ped || !DoesEntityExist(ped)) {
		return false;
	}

	const sequence = openSequence(0);

	if(typeof sequence !== 'number' || sequence <= 0) {
		return false;
	}
	try {
		build();
	} finally {
		CloseSequenceTask(sequence);
	}
	if(options.repeat) {
		SetSequenceToRepeat(sequence, true);
	}
	if(options.holdThroughEvents) {
		SetPedKeepTask(ped, true);
		SetBlockingOfNonTemporaryEvents(ped, true);
	}
	TaskPerformSequence(ped, sequence);
	ClearSequenceTask(sequence);
	return true;
};

/** Which task of its sequence the ped is on, or -1 when it is not running one. */
export const sequenceProgress = (ped: number): number => (ped && DoesEntityExist(ped) ? GetSequenceProgress(ped) : -1);

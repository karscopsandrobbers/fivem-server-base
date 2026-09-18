/*
 * E on a map prop. Two kinds to start with: a bench or a chair to sit on (client-only, a
 * scenario at the prop), and a bin or a dumpster to search (the server rolls what is in it).
 * Add a kind by adding a catalogue entry.
 */
import { EVENTS } from '@shared/events';
import { angleClamp360 } from '@shared/index';
import { definePrompt } from '../index';
import { PromptTarget } from '../types';

interface PropKind {
	id: string;
	label: string;
	models: readonly string[];
	reach: number;
	onInteract: (prop: number, model: string) => void;
}

const SEARCH_RANGE = 6.0;

/** Down and out again with a scenario: G stands up. */
let seated: { prop: number } | null = null;

const sit = (prop: number, model: string): void => {
	const ped = PlayerPedId();

	if(seated) {
		ClearPedTasks(ped);
		seated = null;
		return;
	}

	const [x, y, z] = GetEntityCoords(prop, false);
	const heading = angleClamp360(GetEntityHeading(prop) + 180.0);
	const lift = model === 'prop_hobo_seat_01' ? 0.65 : 0.55;

	FreezeEntityPosition(prop, true);
	TaskStartScenarioAtPosition(ped, 'PROP_HUMAN_SEAT_BENCH', x, y, z + lift, heading, 0, true, true);
	seated = { prop };
};

const search = (prop: number, model: string): void => {
	const [x, y, z] = GetEntityCoords(prop, false);

	TaskTurnPedToFaceCoord(PlayerPedId(), x, y, z, 500);
	emitNet(EVENTS.SERVER_PROP_SEARCH, { model, x, y, z });
};

const KINDS: readonly PropKind[] = [
	{
		id: 'sit',
		label: 'Sit',
		reach: 1.2,
		models: [
			'prop_bench_01a', 'prop_bench_01b', 'prop_bench_01c', 'prop_bench_02', 'prop_bench_03', 'prop_bench_04',
			'prop_bench_05', 'prop_bench_06', 'prop_bench_08', 'prop_bench_09', 'prop_bench_10', 'prop_bench_11',
			'prop_wait_bench_01', 'prop_chair_01a', 'prop_chair_01b', 'prop_chair_02', 'prop_chair_03', 'prop_chair_04a',
			'prop_chair_04b', 'prop_chair_05', 'prop_chair_06', 'prop_chair_08', 'prop_chair_09', 'prop_chair_10',
			'prop_off_chair_01', 'prop_off_chair_03', 'prop_off_chair_04', 'prop_off_chair_05', 'prop_table_04_chr',
			'prop_table_05_chr', 'prop_table_06_chr', 'prop_hobo_seat_01', 'v_ilev_chair02_ped',
		],
		onInteract: sit,
	},
	{
		id: 'search',
		label: 'Search',
		reach: 1.8,
		models: [
			'prop_dumpster_01a', 'prop_dumpster_02a', 'prop_dumpster_02b', 'prop_dumpster_3a', 'prop_dumpster_4a', 'prop_dumpster_4b',
			'prop_bin_01a', 'prop_bin_02a', 'prop_bin_03a', 'prop_bin_04a', 'prop_bin_05a', 'prop_bin_06a', 'prop_bin_07a',
			'prop_bin_07b', 'prop_bin_07c', 'prop_bin_07d', 'prop_bin_08a', 'prop_bin_09a', 'prop_bin_10a', 'prop_bin_10b',
			'prop_bin_11a', 'prop_bin_11b', 'prop_bin_12a', 'prop_bin_14a', 'prop_bin_14b', 'prop_recyclebin_01a',
			'prop_recyclebin_02a', 'prop_recyclebin_02b', 'prop_recyclebin_04_a', 'prop_recyclebin_05_a',
		],
		onInteract: search,
	},
];

/** Hash -> [kind, model name], built once. */
const byHash = new Map<number, [PropKind, string]>();

for(const kind of KINDS) {
	for(const model of kind.models) {
		byHash.set(GetHashKey(model) >>> 0, [kind, model]);
	}
}

interface Found {
	kind: PropKind;
	model: string;
}

definePrompt({
	id: 'props',
	key: 'E',
	label: target => (seated ? 'Stand up' : (target.data as Found).kind.label),
	find: (): PromptTarget[] => {
		const self = PlayerPedId();

		// Seated: the prompt stays on the seat, and says so.
		if(seated) {
			if(!DoesEntityExist(seated.prop) || !IsPedUsingScenario(self, 'PROP_HUMAN_SEAT_BENCH') && !IsPedActiveInScenario(self)) {
				seated = null;
			} else {
				const found = byHash.get(GetEntityModel(seated.prop) >>> 0);

				return found ? [{ key: `prop:${seated.prop}`, entity: seated.prop, offset: { x: 0, y: 0, z: 0.8 }, interactDistance: 3.0, data: { kind: found[0], model: found[1] } }] : [];
			}
		}

		const [px, py, pz] = GetEntityCoords(self, true);
		let best: { prop: number; found: [PropKind, string]; distance: number } | null = null;

		for(const prop of GetGamePool('CObject') as number[]) {
			const found = byHash.get(GetEntityModel(prop) >>> 0);

			if(!found || !DoesEntityExist(prop) || HasObjectBeenBroken(prop)) {
				continue;
			}

			const [x, y, z] = GetEntityCoords(prop, false);
			const distance = Vdist(px, py, pz, x, y, z);

			if(distance < SEARCH_RANGE && (!best || distance < best.distance)) {
				best = { prop, found, distance };
			}
		}
		if(!best) {
			return [];
		}
		return [{
			key: `prop:${best.prop}`,
			entity: best.prop,
			offset: { x: 0, y: 0, z: 0.6 },
			interactDistance: best.found[0].reach,
			data: { kind: best.found[0], model: best.found[1] },
		}];
	},
	onInteract: target => {
		const { kind, model } = target.data as Found;

		if(target.entity && DoesEntityExist(target.entity)) {
			kind.onInteract(target.entity, model);
		}
	},
});

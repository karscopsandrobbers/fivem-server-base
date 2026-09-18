/*
 * The peds placed at boot: a demo of every kind the pool makes. Delete these and put your own in.
 * Positions are Vector4s: where they stand, and which way they face.
 */
import { Vector4 } from '@shared/math/Vector4';
import { PED_ROLE } from '@shared/peds/pedBrain';
import { GUARD_GROUP } from './guards';

const DEMO_PEDS = [
	// A shopkeeper behind the Legion Square 24/7 counter: an actor with a scenario.
	{ model: 'mp_m_shopkeep_01', at: new Vector4(24.8746, -1346.6082, 29.4970, 267.0), scenario: 'WORLD_HUMAN_STAND_IMPATIENT' },
	// A guard outside Mission Row: aim at him and he draws.
	{ model: 's_m_m_security_01', at: new Vector4(437.4280, -983.3134, 30.6896, 88.0), scenario: 'WORLD_HUMAN_GUARD_STAND', guard: true },
];

on('onResourceStart', (resource: string) => {
	if(GetCurrentResourceName() !== resource) {
		return;
	}
	for(const entry of DEMO_PEDS) {
		if(entry.guard) {
			globalThis.mp.peds.newActor(entry.model, entry.at.position, {
				heading: entry.at.heading,
				scenario: entry.scenario,
				role: PED_ROLE.GUARD,
				invincible: false,
				health: 300,
				armour: 50,
				relationshipGroup: GUARD_GROUP,
				suffersCriticalHits: false,
			});
		} else {
			globalThis.mp.peds.newActor(entry.model, entry.at.position, { heading: entry.at.heading, scenario: entry.scenario });
		}
	}
	globalThis.mp.logger.info(`[peds]: ${DEMO_PEDS.length} demo ped(s) placed.`);
});

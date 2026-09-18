/*
 * A fight: armed and on a side, going for somebody. The client being fought is the one that
 * performs it: a combat task issued from the target's own machine is the one that does not stutter.
 */
import type { FightParams } from '@shared/peds/pedBrain';
import { noteThreatTask } from '../threats';
import { paramsOf, playerPedOf, type Performer } from './performer';

const CIVILIAN_RELATIONSHIP_GROUP = 'CIVMALE';
/** Combat re-plans on its own and takes the trigger tuning with it, so it is put back this often. */
const RETASK_MS = 3000;
/** The least time between two combat tasks handed to the same ped: each one is a network threat event. */
const REENGAGE_MS = 12000;
const COMBAT_TASK = GetHashKey('SCRIPT_TASK_COMBAT');
const TASK_NOT_RUNNING = 7;

/** Per-weapon state the combat task owns and resets: reapplied after the weapon, after the task, and on the tick. */
const tune = (ped: number, hostile: FightParams): void => {
	if(!DoesEntityExist(ped)) {
		return;
	}
	if(typeof hostile.shootRate === 'number') {
		SetPedShootRate(ped, hostile.shootRate);
	}
	if(hostile.firingPattern) {
		SetPedFiringPattern(ped, GetHashKey(hostile.firingPattern));
	}
};

const engage = (ped: number, target: number, hostile: FightParams): void => {
	// IMMEDIATELY: a ped running a scenario ignores tasks handed to it.
	ClearPedTasksImmediately(ped);
	TaskCombatPed(ped, target, 0, 16);
	noteThreatTask('fight');
	tune(ped, hostile);
};

export const fight: Performer = {
	started: 'fighting',
	claim: (view, me, ped) => view.target === me && !IsPedInCombat(ped, PlayerPedId()),
	apply: (ped, view, scratch, _previous, now) => {
		const hostile = paramsOf<FightParams>(view);
		const group = GetHashKey(hostile.group || CIVILIAN_RELATIONSHIP_GROUP);

		scratch.wasGroup ??= GetPedRelationshipGroupHash(ped);
		if(hostile.group) {
			AddRelationshipGroup(hostile.group);
			SetPedRelationshipGroupHash(ped, group);
		}
		SetBlockingOfNonTemporaryEvents(ped, true);
		SetPedFleeAttributes(ped, 0, false);
		// BF_AlwaysFlee off; BF_CanFightArmedPedsWhenNotArmed and BF_AlwaysFight on; cover fire off.
		SetPedCombatAttributes(ped, 17, false);
		SetPedCombatAttributes(ped, 46, true);
		SetPedCombatAttributes(ped, 5, true);
		SetPedCombatAttributes(ped, 2, false);
		SetCanAttackFriendly(ped, false, false);
		SetPedCombatAbility(ped, hostile.ability ?? 1);
		SetPedAccuracy(ped, hostile.accuracy ?? 35);
		SetPedCombatRange(ped, hostile.range ?? 1);
		SetPedCombatMovement(ped, hostile.movement ?? 1);
		SetPedCombatAttributes(ped, 21, (hostile.movement ?? 1) !== 0);
		SetPedCombatAttributes(ped, 0, hostile.cover === true);
		SetPedCombatAttributes(ped, 12, hostile.cover === true);
		SetPedCombatAttributes(ped, 23, hostile.needsLineOfSight === true);
		SetPedCombatAttributes(ped, 58, hostile.neverFlee === true);
		if(hostile.weapon) {
			GiveWeaponToPed(ped, GetHashKey(hostile.weapon), 250, false, true);
		}
		// After the weapon, never before: being handed a gun resets both of these.
		tune(ped, hostile);
		scratch.nextRetask = now + RETASK_MS;

		const target = playerPedOf(view.target);

		if(!target) {
			// Armed and on a side, with nobody named yet.
			return true;
		}
		if(hostile.group && hostile.hatesPlayers !== false) {
			SetRelationshipBetweenGroups(5, group, GetHashKey('PLAYER'));
			SetRelationshipBetweenGroups(5, GetHashKey('PLAYER'), group);
			SetPedAsEnemy(ped, true);
		}

		const retarget = scratch.engagedTarget !== undefined && scratch.engagedTarget !== view.target;

		// Control moving between clients runs apply again; a fight already under way is left running.
		if(retarget || (GetScriptTaskStatus(ped, COMBAT_TASK) === TASK_NOT_RUNNING && !IsPedInCombat(ped, target))) {
			if(!hostile.silent) {
				PlayPedAmbientSpeechNative(ped, 'GENERIC_INSULT_HIGH', 'SPEECH_PARAMS_FORCE_SHOUTED');
			}
			engage(ped, target, hostile);
		}
		scratch.engagedTarget = view.target;
		scratch.nextEngage = now + REENGAGE_MS;
		return true;
	},
	tick: (ped, view, scratch, now) => {
		if(now < Number(scratch.nextRetask ?? 0)) {
			return null;
		}
		scratch.nextRetask = now + RETASK_MS;

		const hostile = paramsOf<FightParams>(view);

		tune(ped, hostile);

		// Back into the fight if the task slipped: an event-deaf ped never picks a target back up on its own.
		const target = playerPedOf(view.target);

		if(target && !IsEntityDead(target) && now >= Number(scratch.nextEngage ?? 0)
			&& GetScriptTaskStatus(ped, COMBAT_TASK) === TASK_NOT_RUNNING && !IsPedInCombat(ped, target)) {
			scratch.nextEngage = now + REENGAGE_MS;
			TaskCombatPed(ped, target, 0, 16);
			tune(ped, hostile);
			noteThreatTask('fight: back into it');
		}
		return null;
	},
	/** Put the gun away and go back to being nobody's enemy. */
	clear: (ped, scratch) => {
		if(!DoesEntityExist(ped)) {
			return;
		}

		const was = scratch.wasGroup;

		SetPedAsEnemy(ped, false);
		SetPedRelationshipGroupHash(ped, typeof was === 'number' && was !== 0 ? was : GetHashKey(CIVILIAN_RELATIONSHIP_GROUP));
		SetPedCombatAttributes(ped, 5, false);
		SetPedCombatAttributes(ped, 46, false);
		for(const flag of [0, 12, 23, 58]) {
			SetPedCombatAttributes(ped, flag, false);
		}
		SetPedFleeAttributes(ped, 0, false);
		RemoveAllPedWeapons(ped, true);
		ClearPedTasksImmediately(ped);
	},
};

/*
 * The server cannot call ped, vehicle or vfx natives, and FiveM only syncs natural entity state.
 * This is the vocabulary the server uses to ask every client to run one of those on an entity.
 * Entities are addressed by NETWORK id: handles differ per machine, net ids are global.
 */
export const TASKS = {
	PLAY_ANIM: 'taskPlayAnim',
	PLAY_ANIM_ADVANCED: 'taskPlayAnimAdvanced',
	STOP_ANIM: 'stopAnimTask',
	FACIAL_ANIM: 'playFacialAnim',
	/** An animation on an OBJECT rather than a ped. */
	PLAY_ENTITY_ANIM: 'playEntityAnim',

	SCENARIO_IN_PLACE: 'taskStartScenarioInPlace',
	SCENARIO_AT_POSITION: 'taskStartScenarioAtPosition',

	GO_STRAIGHT_TO_COORD: 'taskGoStraightToCoord',
	TURN_TO_FACE_ENTITY: 'taskTurnToFace',
	TURN_TO_FACE_COORD: 'taskTurnToFaceCoord',
	AIM_GUN_AT_ENTITY: 'taskAimGunAt',
	HANDS_UP: 'taskHandsUp',

	ENTER_VEHICLE: 'taskEnterVehicle',
	LEAVE_VEHICLE: 'taskLeaveVehicle',

	CLEAR_TASKS: 'clearTasks',
	CLEAR_TASKS_IMMEDIATELY: 'clearTasksImmediately',

	PTFX_AT_COORD: 'startParticleFxNonLoopedAtCoord',
	PTFX_ON_ENTITY: 'startParticleFxNonLoopedOnEntity',
	PLAY_SOUND_FROM_ENTITY: 'playSoundFromEntity',

	ATTACH_TO: 'attachTo',
	DETACH: 'detach',

	REPAIR_VEHICLE: 'repairVehicle',
	FLIP_VEHICLE: 'flipVehicle',
	SET_ARMOUR: 'setArmour',
	SET_HEALTH: 'setHealth',
	REMOVE_ALL_WEAPONS: 'removeAllWeapons',
	GIVE_WEAPON: 'giveWeapon',
	LOAD_IPL: 'loadIpl',
	REMOVE_IPL: 'removeIpl',
} as const;

export type TaskName = typeof TASKS[keyof typeof TASKS];

export interface TaskRequest {
	/** Network id of the entity to run the task on. */
	netId: number;
	name: TaskName;
	args: unknown[];
}

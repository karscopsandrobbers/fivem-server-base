# Floating prompts

A prompt is a thing in the world worth walking to. Far off it is a dot inside a ring; close enough
to use, the ring opens into a key cap and a label. Several verbs on one anchor stack into a list.

## Defining one

A **definition** says what it looks for; the one shared scan finds it (every quarter second, or its
own `scanMs`) and the one frame loop draws it.

```ts
import { definePrompt } from '../index';

definePrompt({
	id: 'vehicle_lock',
	key: 'E',
	label: target => (Entity(target.data as number).state.locked ? 'Unlock' : 'Lock'),
	find: () => {
		// Everything of this kind near the player, right now. Return [] for nothing.
		return [{ key: `vehicle:${handle}`, entity: handle, offset: { x: 0, y: 0, z: 1.15 }, data: handle }];
	},
	onInteract: target => emitNet(EVENTS.SERVER_VEHICLE_TOGGLE_LOCK, NetworkGetNetworkIdFromEntity(target.data as number)),
});
```

- `key` is a letter from `PROMPT_KEYS`; `control` is a GTA control id. Say one, not both. The cap
  prints what the control is bound to right now, so a rebound key reads right.
- `target.key` must be stable while it is the same thing, or the prompt is rebuilt every scan and
  flickers.
- `rows(target)` returns several verbs for one target, each with its own key and `onInteract`.
- `drawOnly` draws the cap but never answers it, for a key something else owns.
- `info` is words with no key: what would be needed, or why not.
- `states` says where the player must be (`PROMPT_STATE.ON_FOOT`, `VEHICLE`); unset is on foot.

A definition that throws is switched off and named in F8, so it cannot take every other prompt down
with it. `/prompts` lists them; `/prompts <id> off` switches one.

## The three that ship

| Definition | On | What |
| --- | --- | --- |
| `ped_talk` | the nearest ped on foot | server: they turn to you and nod |
| `vehicle_lock` | the nearest vehicle | server: lock or unlock |
| `props` | benches, chairs, bins, dumpsters | sit (client-only scenario), or search (server rolls a find) |

The client never acts on the world by itself except for the sit. Everything else sends a **net id**
(or a model and position, for a map prop) and the server resolves it, checks the distance, and does
the thing. A client that can name any entity it likes cannot be trusted with the handle.

## Imperative prompts

`createPrompt(options)` for a module already scanning for its own reasons: the same drawing and key
handling, and `destroy()` when it is done. `createPromptGroup(anchor, rows)` stacks several.

## Style

`style.ts` holds every number: sizes, colours, the pulse, the slant of the cap. The game has no
primitive for a circle or a skewed box, so the shapes are built out of `DrawRect`. `ring.ts` is a
progress ring pinned over a world position, for a countdown you can see where it is happening.

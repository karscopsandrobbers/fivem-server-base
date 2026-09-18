# The ped brain

A ped does one thing at a time. The server decides what and writes it on the ped's own `brain`
state bag; every client that can see the ped reads it, and the one with network control performs
it. A request below what the ped is already doing is refused. When an activity ends, the one beneath
it resumes: the stack is the server's, and the clients only ever see the top of it.

## Vocabulary (`utils/shared/peds/pedBrain.ts`)

**Activities**, lowest priority first: `idle`, `cower`, `hide`, `kneel`, `wary`, `flee`, `phone`,
`surrender`, `fight`, `down`, `dead`. `PRIORITY` is a total order the whole brain leans on; a request
below the current activity is refused, equal goes on top.

**Roles** say who a ped answers to: `actor` (placed to be somewhere), `guard`, `civilian` (one of the
game's own people, taken for a while), `reflex` (a client's own decision, never on the bag).

**Traits** (`pedTraits.ts`): nerve, greed, loyalty, rolled from the ped's identity so the same ped is
the same person every time. They decide the beat before somebody obeys and how fast they run; they
never change PRIORITY.

## The server half (`server/core/peds/brain`)

```ts
pedBrain.adopt(handle, role, { idle, ambient })   // give a ped a brain (server peds get one at birth)
pedBrain.request(handle, ACTIVITY.SURRENDER, { target: playerId, until: unixSeconds })
pedBrain.release(handle, ACTIVITY.SURRENDER)      // or by the token request() assigned
pedBrain.setIdle(handle, { scenario: 'WORLD_HUMAN_SMOKING' })
pedBrain.busierThan(handle, kind)                 // would a request be refused right now?
pedBrain.onAimedAt(role, (brain, playerId) => …)  // a gun on a ped of this role
pedBrain.onAimHeld(role, …)                       // held on them past BRAIN.AIM_HOLD_MS
pedBrain.onReport(role, (brain, report, kind) => …)
```

Reports come from the client performing the act: `dialling`, `stopped`, `fighting`, `dead`,
`posted`. `done` is the server's own clock running out and `gone` its own sweep (an ambient ped that
streamed out of everybody's range). A report names the ped by net id and is taken only from a
spawned player close enough to have seen it.

**The demo roles** in this base:

- `civilians.ts` — a weapon on one of the game's own people adopts them as `civilian` and asks for
  `surrender`; the weapon held on them releases that and asks for `flee`. E on one turns them to you
  with a nod. When the reaction runs out the ped is forgotten.
- `guards.ts` — a weapon on a `guard` (or a hit) asks for `fight` against that player, with a pistol
  and the guard's relationship group.
- `handler.ts` — the two demo peds placed at boot: a shopkeeper at Legion Square's 24/7 and a guard
  outside Mission Row. Replace them with yours.

## The client half (`client/core/peds/brain`)

`index.ts` is the director: it adopts every ped in scope that wears a `brain` bag, and if this client
controls the ped, puts the top activity's **performer** on it (`acts/`). Control moves as players
move, so the act is put back by whoever has it now. A performer's `apply` may return false to be
asked again next poll (a clip still loading, a beat of hesitation). `fight` claims control for the
client being fought: a combat task from the target's own machine is the one that does not stutter.

**Reflexes** are the client's own decisions about the game's people it controls, through the same
performers and priorities, never on the bag:

- `anticipation.ts` — a drawn weapon is noticed by the people facing you; they stop and watch (`wary`).
- `contagion.ts` — panic spreads from anybody visibly frightened to the people near them, a couple
  of hops at most.

`perception.ts` is the one look around: every ped near the player once a second, for every system
that needs to pick one. `threats.ts` counts the threat tasks this client starts, because each one is
a network event and a client that queues too many crashes.

## Debugging

`/debug` (admin) turns debug mode on; the `peds` channel draws every ped's role, activity, whose
client performs it, any reflex over it, and its traits. `/brains` lists the server's stacks in the
console.

## Gotchas

- The server cannot see ped health: an unstreamed ped reads 0. Death is reported by the clients.
- A ped running a scenario ignores tasks handed to it: performers use `ClearPedTasksImmediately`.
- Being handed a weapon and starting a combat task both reset the shoot rate and firing pattern, so
  `fight` re-applies them after both and on its tick.
- A ped created by the server has no room assigned inside an MLO; `client/core/peds/index.ts` pins it
  to the interior it stands in, or it vanishes from inside the room.

# Entities

Everything the server owns is in a pool on `mp`, and every pool answers the same contract:
`at(id)`, `exists(id)`, `remove(id)`, `forEach`, `filter`, `find`, `toArray`, `length`, iteration.

| Pool | Entity | `id` is |
| --- | --- | --- |
| `mp.players` | `EntityPlayer` | the server id (`source`) |
| `mp.vehicles` | `EntityVehicle` | the entity handle |
| `mp.peds` | `EntityPed` | the entity handle |
| `mp.objects` | `EntityObject` | the entity handle |

`source` arrives as a string; every pool normalises it, so `mp.players.at(source)` works.

## Replicated data: state bags

`player.data.x = v` and `vehicle.data.x = v` write to the entity's state bag, which every client
reads (`Player(id).state.x`, `Entity(handle).state.x`). The proxy caches server-side reads and passes
`replicate = true` explicitly, because FiveM for GTAV Enhanced replicates only when asked.

Bags are **shallow**: only a whole top-level key assignment replicates. Never mutate a nested object
in place; rebuild it and assign the key.

`player.info` is server-only scratch that never leaves the process.

`mp.world.data.x = v` does the same on `GlobalState`, which every client reads at any distance.

## Players

```ts
const player = mp.players.at(source);
player.position;                       // Vector3, and a setter
player.teleport(new Vector3(x, y, z), heading, dimension);
player.spawn(position, heading, model);   // runs the client's spawn routine
player.dimension = 1;                  // routing bucket
player.clientMessage('hello');         // through the stock chat resource
player.notify('~g~done');              // GTA's notification feed
player.showShard('Title', 'Subtitle');
player.text('KEY', arg1, arg2);        // translated into their language
player.languageMessage('KEY', ...);
player.isAdmin();                      // the base.admin ace
```

`playerJoining` and `playerDropped` add and remove players from the pool. `player.data.spawned`
becomes true after the first spawn.

## Vehicles

`createVehicle(model, position, heading, { type })` in `server/core/vehicles`. The `type` is what
`CREATE_VEHICLE_SERVER_SETTER` accepts (`automobile` by default; a bike, a boat and a helicopter each
need their own), and a wrong one is refused outright.

The server can write a few vehicle natives (coords, plate, locks, colours) and none of the mod ones.
Everything else rides the state bag and every client applies it (`client/core/vehicles`): `locked`,
`engine`, `numberPlate`, `primaryColour`, `primaryRGB`, `extras`, and the `mods` table that
`setMod`, `setWindowTint`, `setLivery`, `setWheelType`, `setNeonColor` write.

Every vehicle the server can see joins the pool through `entityCreated`, ours or not.

## Peds

`mp.peds.new(model, position, options)` makes a networked ped with the engine's defaults;
`mp.peds.newActor` makes one that holds its post (ignores gunfire, never flees, invincible unless
told otherwise). Both take a scenario, a heading, health, armour, a relationship group, components
and a `role` for the brain. See [peds.md](peds.md).

What a ped IS is its `pedConfig` bag, applied by every client that streams it in. What it is DOING
is its `brain` bag.

Every server ped is `KeepEntity` (orphan mode 2): placed once, still there when everybody walks away.
The pool deletes all of them on resource stop.

## Objects

`mp.objects.new(model, position, { rotation, frozen })`. `object.playAnim(dict, clip)` animates the
prop on every client.

## The task relay

The server cannot call ped, vehicle or vfx natives. `player.playTask(TASKS.X, ...args)` (and the
same on vehicles and objects) sends the entity's **network id** and the arguments to every client,
which runs the native (`client/core/tasks.ts`). That is how `player.playAnimation`,
`playParticleOnSelf`, `putIntoVehicle`, `giveWeapon` and `setHealth` work. Entities are always
addressed by net id: handles differ per machine.

## Objective markers

`setObjectiveMarker(handle, { rotation, scale, colourRgba, bobUpAndDown, timeMs })` writes a marker
onto any server entity's bag; every client with the entity in scope draws it above the model.

## Blips, markers, labels

FiveM's server has none of these, so `mp.world.blips.new(name, sprite, position)`,
`mp.world.markers.new(type, position)` and `mp.world.labels.new(text, position)` are registries
replicated on `GlobalState` and drawn by every client (`client/core/world`). Each `new` returns an
entry with an `id` that `remove(id)` takes.

## Shutdown

`onResourceStop` deletes every vehicle, ped and object the server made. A server-created entity
outlives the resource that made it, so without this a `restart base` would leave its peds standing.

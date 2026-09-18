# FiveM Base

A barebones FiveM server in TypeScript. You spawn somewhere in Los Santos, there is a chat, and
there are a handful of systems worth building a gamemode on:

- **Entity pools** — `mp.players`, `mp.vehicles`, `mp.peds`, `mp.objects`, with replicated data
  through state bags, and `mp.world` for blips, markers and labels every client draws.
- **A ped brain** — one activity per ped, a server-owned stack, and the client that controls the ped
  performing the top of it. Aim a gun at somebody and their hands go up; keep it on them and they run;
  aim at the guard and he draws.
- **Floating prompts** — a key cap and a label drawn in the world over anything worth walking to. E on
  a person, a car, a bench, a bin.
- **GUI helpers** — text in the world, notifications, help text, the big and midsized scaleform
  messages, instructional buttons.
- **i18n** — every string the server sends comes out of `i18n/<code>.json` in the player's language.
- **Content packs** — drop streamed assets into `resources/[dlc]/dlc_<name>/stream/` and the manifest
  and the `ensure` line are generated.

The repository root doubles as the **server-data** folder (`server.cfg`, `resources.cfg`, `start.bat`).
The TypeScript source lives in `base/` and builds into `resources/base` (gitignored).

## Requirements

| Tool | Version |
| --- | --- |
| Node.js | 22+ (FXServer bundles Node 22, so match it locally) |
| npm | 10+ |
| FXServer | Legacy FiveM artifact from <https://runtime.fivem.net/artifacts/fivem/>, unpacked into a sibling folder called `server` |

No database. A player's language is remembered in the resource's key-value store; everything else is
per session.

## First-time setup

```sh
cp keys.cfg.example keys.cfg      # then paste your sv_licenseKey from https://portal.cfx.re
cd base
npm install
npm run build                     # type-checks, bundles into ../resources/base, smoke-tests both bundles
```

The stock `chat` resource is what the base talks through. On Legacy FXServer it ships inside the
artifact (`server/citizen/system_resources/chat`) and `ensure chat` finds it there; if your build
does not have it, copy that folder into `resources/`.

Then, from the repository root:

```sh
./start.bat        # Windows
./start.sh         # Linux
```

Join with `connect localhost` in the F8 console. You spawn at a random spot in Los Santos.

## Applying code changes

FXServer runs the compiled output, so every change needs a build and a resource restart:

```sh
cd base && npm run build
```

then in the server console:

```
restart base
```

`npm run watch` rebuilds on every save (skipping the type-check); you still `restart base` to apply it.
Run a full `npm run build` before committing.

## Admin

Commands that change the world need the `base.admin` ace. Type `basewho` in the server console to see
your identifiers, then in `permissions.cfg`:

```
add_principal identifier.license:<yours> group.admin
```

| Command | What |
| --- | --- |
| `/pos` | Where you are standing (everyone) |
| `/language <name>` | Change your language (everyone) |
| `/car <model> [type]` | Spawn a vehicle: `type` is `automobile` (default), `bike`, `boat`, `heli`, `plane`... |
| `/dv` | Delete the vehicle you are in or beside |
| `/ped <model> [scenario]` | Place a ped in front of you |
| `/dp` | Delete every ped the server placed |
| `/tp <x> <y> <z>` | Teleport |
| `/weapon <name>` | Give yourself a weapon |
| `/heal` | Full health and armour |
| `/marker`, `/blip <name>` | Drop a world marker with a label, or a map blip, where you stand |
| `/shard <text>`, `/midsized <text>`, `/help <text>` | Show yourself each kind of GUI message |
| `/debug` | Debug mode: the ped brain and the vehicle ids draw what they know |
| `/brains` | List every ped with a brain in the console |

Client-side (F8 console): `/prompts` lists the prompt definitions, `/debugchannel <name>` quietens one
debug overlay.

## Where things are

```
base/src/
  utils/shared/       what both sides know: events, math, tasks, the ped brain vocabulary, spawns
  server/core/
    config.ts         the `mp` namespace
    entities/         Player, Vehicle, Ped, Object and their pools
    world/            mp.world: replicated state, blips, markers, labels; the prop search
    vehicles/         createVehicle, the pool adopting engine vehicles, the lock toggle
    peds/             the brain (server half), the civilians' reactions, the guard, the demo peds
    player/           the random spawn and respawn, the location relay
    i18n/             the catalogues, the player's language
    commands/         chat commands
  client/
    core/entity/      objective markers
    core/world/       the blip / marker / label renderer
    core/vehicles/    applies what the server said about a vehicle
    core/peds/        pedConfig, the brain (client half), the acts a ped performs
    core/prompts/     the prompt system and its definitions (peds, vehicles, props)
    core/tasks.ts     the task relay: natives the server asks every client to run
    gui/              text, notifications, scaleforms
    modules/          natives wrappers, instructional buttons, sequences
docs/                 how each system works
```

Every folder's `index.ts` is its import list. esbuild bundles only what an entry reaches, so a module
nobody imports is silently absent: add new modules to the registry, not to the entry.

## Docs

- [docs/entities.md](docs/entities.md) — the pools, state bags, the task relay
- [docs/peds.md](docs/peds.md) — the ped brain
- [docs/prompts.md](docs/prompts.md) — floating prompts and the interaction flow
- [docs/gui.md](docs/gui.md) — text, notifications, scaleforms, instructional buttons
- [docs/i18n.md](docs/i18n.md) — languages
- [docs/dlcpacks.md](docs/dlcpacks.md) — content packs

## Renaming

The resource is called `base`. To rename it: `resourceName` in `base/scripts/build.js`, the two smoke
scripts' bundle paths, `ensure base` in `resources.cfg`, the `+base:` key-mapping prefix in
`client/core/controls.ts`, and the `base:` event prefix in `utils/shared/events.ts`.

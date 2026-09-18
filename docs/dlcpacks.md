# Content packs

Streamed assets — custom vehicles, map props, interiors — go under `resources/[dlc]/`, one resource
per pack. Those folders are build output except for their `stream/` and `data/`, which are tracked.
The manifests are generated: **do not edit an `fxmanifest.lua` by hand**, edit `base/scripts/dlc.js`
and re-run it.

```
npm run dlc                      discover packs, rebuild manifests, update the ensure list
node ./scripts/dlc.js --check    report what is there, change nothing
```

`npm run build` runs it too, so a fresh clone starts cleanly.

## Adding a pack

```
mkdir -p "resources/[dlc]/dlc_<name>/stream"     # .ydr .ydd .yft .ytd .ymap .ytyp .ycd .ybn, flat
mkdir -p "resources/[dlc]/dlc_<name>/data"       # .meta files
cd base && npm run dlc
```

Packs are **discovered** from the folders, so nothing is registered in code: the manifest is
generated, the `ensure dlc_<name>` line is added to `resources.dlc.cfg` between its markers, and
removing the folder removes the line again.

The kind is inferred: a `vehicles.meta` means vehicles, a `.ymap` or `.ybn` means world content. Add
an entry to `KNOWN` in `dlc.js` to pin it and give it a description.

Flat is deliberate. The streamer finds assets by name, not path, and two files with the same name in
different subfolders collide.

## Packs that arrive as their own FiveM resource

Move their `stream/` contents into `dlc_<name>/stream/` and run the generator. A `__resource.lua` (the
pre-2019 manifest name) is deleted for you. Anything else they carry (a `.lua` script, a config) is
not handled here: a pack that runs code is an ordinary resource and belongs outside `[dlc]`.

## What the generator checks

- A `.yft` with no `vehicles.meta`: the model streams but cannot be spawned.
- A file whose header does not match its extension: a drawable saved under a `.ymap` name crashes the
  game later, somewhere that names neither file.
- Two files with different names and identical bytes: one of them is misnamed.
- An MLO ymap (`*_milo_*`) with no `_manifest.ymf`: crashes the game on load; re-export it.
- The same filename shipping in two packs: the streamer picks one arbitrarily.

## Ordering

`resources.dlc.cfg` is exec'd before `resources.cfg`. The base creates its world objects as it starts,
and a server-side `CreateObject` on a model no resource has registered yet is refused.

## Game build

`server.cfg` sets `sv_enforceGameBuild 3717`. Gen8 assets stream on Legacy FXServer; FiveM for GTAV
Enhanced runs the latest gamebuild only and needs assets converted for it.

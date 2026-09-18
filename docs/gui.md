# GUI

Everything here draws with natives. There is no NUI page: add one when you need one (`ui_page` in
the manifest, `SendNUIMessage` / `RegisterNuiCallback`), and never build JS source strings.

## Text (`client/gui/index.ts`)

- `drawText(text, [x, y], { font, scale, color, align, wrap })` — screen space, called every frame.
- `drawTextFromWorld(text, [x, y, z], font, color, scale)` — anchored to a world position.
- `addCustomGameText(text, ms, ...)` — a line on screen for a while, fading.
- Long text is split into the three 99-character components the game accepts, never inside a
  `~colour~` token.

Fonts are in `@shared/gui`: ChaletLondon (0), HouseScript (1), Monospace (2),
ChaletComprimeCologne (4), Pricedown (7).

## Notifications and help (`client/gui/messages.ts`)

- `notify(message)` — GTA's feed, top left. `~r~`, `~g~`, `~b~`, `~y~`, `~s~` colour codes.
- `notifyWithPicture(title, subtitle, message, 'CHAR_DEFAULT')` — the portrait form.
- `displayHelp(text)` / `clearHelp()` — the bottom-centre help text; `~INPUT_CONTEXT~` prints the key.

From the server: `player.notify`, `player.displayHelp`, `player.playSound(name, set)`.

## Scaleform messages (`client/gui/scaleform_messages`)

- `showShard(title, subtitle, ms)` — the big freemode message (`MP_BIG_MESSAGE_FREEMODE`).
- `showMidsizedMessage(title, subtitle, ms)` — `MIDSIZED_MESSAGE`.

From the server: `player.showShard`, `player.showMidsized`.

## Scaleforms in general (`client/gui/scaleform`)

`new Scaleform('MOVIE_NAME')`, `callFunction(name, ...args)`, `renderFullscreen()` /
`renderAt(x, y, w, h)`, `dispose()`. Calls made before the movie streamed in are queued and replayed
in order. A number is pushed as an int when whole and a float otherwise; `{ float: 1 }` forces a float.

## Instructional buttons (`client/modules/gui/instructions.ts`)

```ts
const bar = new InstructionalButtons();
bar.addButton('Interact', controls.INPUT_CONTEXT);
bar.addButton('Cancel', controls.INPUT_FRONTEND_CANCEL);
bar.toggle(true);      // drawn every frame until toggle(false) or dispose()
```

Every bar shares one movie. The bar switched on last is the one drawn; the one under it comes back
after.

## Key bindings (`client/core/controls.ts`)

`bindKey('action', 'Description', 'F5', onDown, onUp)` registers a key the player can rebind in
Settings > Key Bindings > FiveM. `bindControl(controls.INPUT_CONTEXT, onDown)` polls a GTA control.
Both are suppressed while a NUI page holds the keyboard.

## Ticks (`client/core/lifecycle.ts`)

`createGatedTick(isActive, handler)` runs a per-frame handler only while the predicate holds, polled a
few times a second; `createManagedTick` is the start/stop pair. `onResourceStop(handler)` is the one
shared resource-stop listener.

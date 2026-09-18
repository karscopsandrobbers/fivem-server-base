#!/bin/sh
# Linux: the FXServer artifact unpacked into ../server (or ./server), run from this folder.
cd "$(dirname "$0")"
BIN="../server/run.sh"
[ -x "$BIN" ] || BIN="./server/run.sh"
exec "$BIN" +set onesync on +exec server.cfg

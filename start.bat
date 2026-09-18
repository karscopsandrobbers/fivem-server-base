@echo off
rem Legacy FiveM, from a sibling folder called server (download from https://runtime.fivem.net/artifacts/fivem/).
rem OneSync goes on the command line: by the time server.cfg runs the convar is locked.
..\server\FXServer.exe +set onesync on +exec server.cfg

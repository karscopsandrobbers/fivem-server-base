/*
 * The server registry. Every module that has to run is named here; esbuild bundles only what an
 * entry reaches, so a module nobody imports is silently absent.
 */
import './config';
import './server/init';
import './game/heartbeat';
import './i18n/events';
import './player/spawn';
import './player/events';
import './entity';
import './vehicles';
import './peds';
import './world/interactions';
import './commands';

/*
 * A scaleform movie: requested once, called with typed arguments, and drawn. Calls made before
 * the movie has streamed in are queued and replayed in order the first frame it is loaded.
 */

/** A number pushed as a FLOAT even when it is whole; some movies read a position that way. */
export interface FloatArg {
	float: number;
}

export type ScaleformArg = string | number | boolean | FloatArg;

const pushArgs = (args: ScaleformArg[]): void => {
	for(const arg of args) {
		if(typeof arg === 'string') {
			PushScaleformMovieFunctionParameterString(arg);
		} else if(typeof arg === 'boolean') {
			PushScaleformMovieFunctionParameterBool(arg);
		} else if(typeof arg === 'object') {
			PushScaleformMovieFunctionParameterFloat(arg.float);
		} else if(Number.isInteger(arg)) {
			PushScaleformMovieFunctionParameterInt(arg);
		} else {
			PushScaleformMovieFunctionParameterFloat(arg);
		}
	}
};

export class Scaleform {
	private handle: number;
	private readonly queued: Array<{ name: string; args: ScaleformArg[] }> = [];

	constructor(private readonly name: string) {
		this.handle = RequestScaleformMovie(name);
	}

	get loaded(): boolean {
		if(this.handle === 0) {
			// A request made before the session was ready hands back nothing; ask again.
			this.handle = RequestScaleformMovie(this.name);
		}
		if(this.handle !== 0 && HasScaleformMovieLoaded(this.handle)) {
			this.flush();
			return true;
		}
		return false;
	}

	async waitUntilLoaded(timeoutMs = 5000): Promise<boolean> {
		const deadline = GetGameTimer() + timeoutMs;

		while(!this.loaded) {
			if(GetGameTimer() > deadline) {
				return false;
			}
			await new Promise<void>(resolve => setTimeout(resolve, 10));
		}
		return true;
	}

	callFunction(name: string, ...args: ScaleformArg[]): void {
		if(!this.loaded) {
			this.queued.push({ name, args });
			return;
		}
		PushScaleformMovieFunction(this.handle, name);
		pushArgs(args);
		PopScaleformMovieFunctionVoid();
	}

	renderFullscreen(): void {
		if(this.loaded) {
			DrawScaleformMovieFullscreen(this.handle, 255, 255, 255, 255, 0);
		}
	}

	renderAt(x: number, y: number, width = 1.0, height = 1.0): void {
		if(this.loaded) {
			DrawScaleformMovie(this.handle, x, y, width, height, 255, 255, 255, 255, 0);
		}
	}

	/** Ask for the movie again after the game let it go. */
	reload(): void {
		this.handle = RequestScaleformMovie(this.name);
	}

	dispose(): void {
		if(this.handle !== 0) {
			SetScaleformMovieAsNoLongerNeeded(this.handle);
			this.handle = 0;
		}
	}

	private flush(): void {
		if(!this.queued.length) {
			return;
		}
		const pending = this.queued.splice(0);

		for(const call of pending) {
			PushScaleformMovieFunction(this.handle, call.name);
			pushArgs(call.args);
			PopScaleformMovieFunctionVoid();
		}
	}
}

import { dev } from "$app/environment";
import { env } from "$env/dynamic/public";

type Level = "trace" | "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { trace: 1, debug: 2, info: 3, warn: 4, error: 5 };
const STYLE: Record<Level, string> = {
	trace: "color: #888888; font-weight: bold",
	debug: "color: #2b5c8f; font-weight: bold",
	info: "color: #2E8B57; font-weight: bold",
	warn: "color: #B8860B; font-weight: bold",
	error: "color: #A52A2A; font-weight: bold"
};

function resolveMinLevel(): number {
	const levelEnv = env.PUBLIC_LOG_LEVEL?.toLowerCase() as Level | undefined;
	if (levelEnv && levelEnv in ORDER) return ORDER[levelEnv];
	return dev ? ORDER.debug : ORDER.warn;
}
const MIN_LEVEL = resolveMinLevel();

export class Logger {
	constructor(private ns: string) {}

	private format(level: Level, msg: string, ...args: unknown[]) {
		const label = level.toUpperCase();
		return [`%c[${label}] [${this.ns}] ${msg}`, STYLE[level], ...args] as const;
	}

	trace(msg: string, ...args: unknown[]) {
		if (ORDER["trace"] >= MIN_LEVEL) console.debug(...this.format("trace", msg, ...args));
	}
	debug(msg: string, ...args: unknown[]) {
		if (ORDER["debug"] >= MIN_LEVEL) console.debug(...this.format("debug", msg, ...args));
	}
	info(msg: string, ...args: unknown[]) {
		if (ORDER["info"] >= MIN_LEVEL) console.info(...this.format("info", msg, ...args));
	}
	warn(msg: string, ...args: unknown[]) {
		if (ORDER["warn"] >= MIN_LEVEL) console.warn(...this.format("warn", msg, ...args));
	}
	error(msg: string, ...args: unknown[]) {
		if (ORDER["error"] >= MIN_LEVEL) console.error(...this.format("error", msg, ...args));
	}

	child(suffix: string) {
		return new Logger(`${this.ns}:${suffix}`);
	}
}

export function createLogger(ns: string = "app") {
	return new Logger(ns);
}

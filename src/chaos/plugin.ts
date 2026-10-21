import type { FastifyInstance } from "fastify";
import type { ChaosConfig } from "./config.ts";

export async function chaosPlugin(
	_app: FastifyInstance,
	_opts: { config: ChaosConfig },
) {
	// Failure injection (latency, errors) comes in a later step.
}

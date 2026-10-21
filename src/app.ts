import { fastifySwagger } from "@fastify/swagger";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { fastify } from "fastify";
import {
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { loadChaosConfig } from "./chaos/config.ts";
import { chaosPlugin } from "./chaos/plugin.ts";

export function buildApp() {
	const app = fastify().withTypeProvider<ZodTypeProvider>();

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	app.register(fastifySwagger, {
		openapi: {
			info: {
				title: "Chaos Engineer API",
				description: "API documentation for Chaos Engineer",
				version: "1.0.0",
			},
		},
		transform: jsonSchemaTransform,
	});

	app.register(ScalarApiReference, {
		routePrefix: "/docs",
	});

	app.register(chaosPlugin, {
		config: loadChaosConfig(),
	});

	return app;
}

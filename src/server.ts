import { fastifySwagger } from "@fastify/swagger";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { fastify } from "fastify";
import {
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "fastify-type-provider-zod";

const server = fastify().withTypeProvider<ZodTypeProvider>();

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(fastifySwagger, {
	openapi: {
		info: {
			title: "Chaos Engineer API",
			description: "API documentation for Chaos Engineer",
			version: "1.0.0",
		},
	},
	transform: jsonSchemaTransform,
});

server.register(ScalarApiReference, {
	routePrefix: "/docs",
});

server.listen({ port: 3000, host: "0.0.0.0" }).then(() => {
	console.log("Server is running on http://localhost:3000");
});

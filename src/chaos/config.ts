export const SERVICE_IDS = [
	"payments",
	"logistics",
	"carriers",
	"erp",
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export type ChaosServiceConfig = {
	failureRate: number;
	latencyMs: number;
};

export type ChaosConfig = {
	global: ChaosServiceConfig;
	services: Partial<Record<ServiceId, Partial<ChaosServiceConfig>>>;
};

export const defaultChaosConfig: ChaosConfig = {
	global: {
		failureRate: 0,
		latencyMs: 0,
	},
	services: {
		payments: {},
		logistics: {},
		carriers: {},
		erp: {},
	},
};

export function loadChaosConfig(): ChaosConfig {
	return defaultChaosConfig;
}

export function resolveServiceConfig(
	config: ChaosConfig,
	serviceId: ServiceId,
): ChaosServiceConfig {
	return {
		...config.global,
		...config.services[serviceId],
	};
}

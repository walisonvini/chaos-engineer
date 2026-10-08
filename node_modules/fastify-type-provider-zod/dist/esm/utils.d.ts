import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
type SwaggerObject = {
	swaggerObject: Partial<OpenAPIV2.Document>;
};
type OpenAPIObject = {
	openapiObject: Partial<OpenAPIV3.Document | OpenAPIV3_1.Document>;
};
export declare const assertIsOpenAPIObject: (obj: SwaggerObject | OpenAPIObject) => asserts obj is OpenAPIObject;
export type JSONSchemaTarget = "draft-2020-12" | "openapi-3.0";
export declare const getReferenceUri: (input: string) => string;
export declare const getJSONSchemaTarget: (version?: string) => JSONSchemaTarget;
export {};

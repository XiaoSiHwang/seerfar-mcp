export type Localized = string | Record<string, string>;
export type JsonObject = Record<string, unknown>;

export interface Parameter {
  name: string;
  docType: string;
  type?: string;
  required?: boolean;
  description?: Localized;
  example?: unknown;
  options?: (string | number | boolean)[];
}

export interface Endpoint {
  id: string;
  label: Localized;
  method: string;
  path: string;
  description: Localized;
  credits?: Localized;
  pathParams?: Parameter[];
  queryParams?: Parameter[];
  headerParams?: Parameter[];
  bodyParams?: Parameter[];
  bodyExample?: JsonObject;
  responseExample?: unknown;
  responseFields?: Parameter[];
  errorResponses?: unknown[];
  [key: string]: unknown;
}

export interface DocsConfig {
  baseUrl: string;
  endpoints: Endpoint[];
  sections: JsonObject[];
  [key: string]: unknown;
}

export interface Sources {
  config: DocsConfig;
  updates: { entries: { date: string; [key: string]: unknown }[]; [key: string]: unknown };
  pricing: { items: { name: Localized; credits: Localized; callCount: Localized }[] };
}

export interface Snapshot {
  schemaVersion: 1;
  id: string;
  fetchedAt: string;
  sourceUrls: Record<keyof Sources, string>;
  contentHash: string;
  sources: Sources;
}

export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  description?: string;
  examples?: unknown[];
  enum?: unknown[];
  anyOf?: JsonSchema[];
  minLength?: number;
  pattern?: string;
  [key: string]: unknown;
}

export interface ApiArguments {
  apiKey?: string;
  path?: JsonObject;
  query?: JsonObject;
  headers?: Record<string, string>;
  body?: JsonObject;
}

export function zh(value: Localized | undefined): string {
  return typeof value === 'string' ? value : value?.['zh-CN'] ?? value?.['en-US'] ?? '';
}

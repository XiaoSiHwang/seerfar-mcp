import type { Endpoint, JsonObject, JsonSchema, Parameter } from './types.js';
import { zh } from './types.js';

export function objectSchema(additionalProperties = true): JsonSchema {
  return { type: 'object', properties: {}, additionalProperties };
}

function exampleAt(example: unknown, parts: string[]): unknown {
  if (Array.isArray(example)) example = example[0];
  if (parts.length === 0) return example;
  if (!example || typeof example !== 'object') return undefined;
  const [head, ...rest] = parts;
  return exampleAt((example as JsonObject)[head!], rest);
}

function inferExample(example: unknown): JsonSchema {
  if (example === null || example === undefined) return {};
  if (Array.isArray(example)) return { type: 'array', items: inferExample(example[0]) };
  if (typeof example === 'object') {
    const schema = objectSchema();
    for (const [key, value] of Object.entries(example)) schema.properties![key] = inferExample(value);
    return schema;
  }
  return { type: typeof example };
}

function parameterSchema(param: Parameter, example: unknown): JsonSchema {
  const type = param.docType.toLowerCase();
  const arrayType = /^array(?:<(.+)>)?$/.exec(type);
  let schema: JsonSchema;
  if (arrayType) {
    const itemType = arrayType[1];
    schema = { type: 'array', items: itemType ? parameterSchema({ name: '', docType: itemType, required: true }, undefined) : inferExample(Array.isArray(example) ? example[0] : undefined) };
    if (param.options?.length) schema.items = { type: 'string', enum: param.options };
  } else if (type === 'object') {
    schema = objectSchema();
  } else if (['number', 'integer', 'boolean', 'string'].includes(type)) {
    schema = { type };
    // 官方部分数值字段的示例使用字符串；同时接受两种写法并原样透传。
    if (['integer', 'number'].includes(type) && typeof example === 'string' && /^\d+$/.test(example)) {
      schema = { anyOf: [{ type }, { type: 'string', pattern: '^\\d+$' }] };
    }
    if (param.options?.length) schema.enum = param.options;
  } else {
    throw new Error(`不支持的文档参数类型：${param.name}: ${param.docType}`);
  }
  if (!param.required) schema = { anyOf: [schema, { type: 'null' }] };
  schema.description = zh(param.description);
  return schema;
}

function nonNull(schema: JsonSchema): JsonSchema {
  return schema.anyOf?.find((item) => item.type !== 'null') ?? schema;
}

function insertParameter(root: JsonSchema, param: Parameter, example: unknown): void {
  const parts = param.name.replace(/\[\]/g, '').split('.');
  let current = root;
  for (let index = 0; index < parts.length; index++) {
    current = nonNull(current);
    if (current.type === 'array') current = current.items ??= objectSchema();
    current.type ??= 'object';
    current.properties ??= {};
    const key = parts[index]!;
    if (index === parts.length - 1) {
      current.properties[key] = parameterSchema(param, exampleAt(example, parts));
      if (param.required) current.required = [...new Set([...(current.required ?? []), key])];
    } else {
      current = current.properties[key] ??= objectSchema();
    }
  }
}

function mergeExample(schema: JsonSchema, example: unknown): void {
  schema = nonNull(schema);
  if (schema.type === 'array') {
    if (Array.isArray(example) && example.length) mergeExample(schema.items ??= {}, example[0]);
    return;
  }
  if (schema.type !== 'object' || !example || typeof example !== 'object' || Array.isArray(example)) return;
  for (const [key, value] of Object.entries(example)) {
    const existing = schema.properties![key];
    if (existing) mergeExample(existing, value);
    else schema.properties![key] = { ...inferExample(value), description: '文档示例字段（参数表未单独列出）' };
  }
}

export function parametersSchema(parameters: Parameter[], example?: JsonObject): JsonSchema {
  const schema = objectSchema();
  for (const param of [...parameters].sort((a, b) => a.name.split('.').length - b.name.split('.').length)) {
    insertParameter(schema, param, example);
  }
  mergeExample(schema, example);
  return schema;
}

export function inputSchema(endpoint: Endpoint, headerKeyAllowed = false): JsonSchema {
  const schema = objectSchema(false);
  schema.properties!.apiKey = {
    type: 'string', minLength: 1, pattern: '\\S',
    description: '本次调用的 Seerfar API Key；仅用于本次请求，不写入配置或复用。HTTP 模式也可用 X-Seerfar-Api-Key 请求头。',
  };
  schema.required = headerKeyAllowed ? [] : ['apiKey'];
  const groups = [
    ['path', endpoint.pathParams], ['query', endpoint.queryParams],
    ['headers', endpoint.headerParams?.filter((p) => p.name.toLowerCase() !== 'authorization' && p.name.toLowerCase() !== 'content-type')],
    ['body', endpoint.bodyParams],
  ] as const;
  for (const [key, params] of groups) {
    if (!params?.length && !(key === 'body' && endpoint.bodyExample)) continue;
    schema.properties![key] = parametersSchema(params ?? [], key === 'body' ? endpoint.bodyExample : undefined);
    if (params?.some((p) => p.required)) schema.required.push(key);
  }
  return schema;
}

export function toolName(endpoint: Endpoint): string {
  return `seerfar_${endpoint.id.replace(/-/g, '_')}`;
}

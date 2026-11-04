import assert from 'node:assert/strict';
import test from 'node:test';
import { Ajv } from 'ajv';
import { loadSnapshot } from '../src/snapshots.js';
import { inputSchema, toolName } from '../src/schema.js';
import { parametersSchema } from '../src/schema.js';
import { readFile } from 'node:fs/promises';
import { ROOT } from '../src/snapshots.js';

const snapshot = await loadSnapshot();
const ajv = new Ajv({ strict: false, allErrors: true });

test('全部 41 个接口生成独立、稳定的工具，且官方完整请求示例通过校验', () => {
  const names = new Set<string>();
  assert.equal(snapshot.sources.config.endpoints.length, 41);
  for (const endpoint of snapshot.sources.config.endpoints) {
    const name = toolName(endpoint);
    assert.match(name, /^[a-zA-Z0-9_]{1,128}$/);
    assert.ok(!names.has(name)); names.add(name);
    const validate = ajv.compile(inputSchema(endpoint));
    assert.ok(validate({ apiKey: 'test-example-key', ...(endpoint.bodyExample ? { body: endpoint.bodyExample } : {}) }),
      `${endpoint.id}: ${JSON.stringify(validate.errors)}`);
  }
});

test('必填、数组对象、数值类型和枚举按文档校验', () => {
  const endpoint = snapshot.sources.config.endpoints.find((e) => e.id === 'ozon-shop-search')!;
  const validate = ajv.compile(inputSchema(endpoint));
  const args = { apiKey: 'key-one', body: { id: 118364, page: { pageNumber: 1, pageSize: 20, orders: [{ field: 'revenue', direction: 'DESC' }] } } };
  assert.ok(validate(args));
  assert.equal(validate({ body: args.body }), false);
  assert.equal(validate({ ...args, apiKey: '   ' }), false);
  assert.equal(validate({ ...args, body: { ...args.body, id: 'bad' } }), false);
  assert.equal(validate({ ...args, body: { ...args.body, page: { ...args.body.page, orders: [{ field: 'x', direction: 'SIDEWAYS' }] } } }), false);
  assert.equal(validate({ ...args, body: { ...args.body, page: { ...args.body.page, orders: [{}] } } }), false);
  assert.equal(validate({ ...args, body: { ...args.body, fulfillment: ['invalid'] } }), false);
  assert.equal(validate({ ...args, baseUrl: 'https://other.example' }), false);
});

test('可选过滤条件允许 null；参数表遗漏的示例字段保留；HTTP 允许请求头动态 Key', () => {
  const endpoint = snapshot.sources.config.endpoints.find((e) => e.id === 'ozon-shop-search')!;
  const schema = inputSchema(endpoint);
  assert.ok(JSON.stringify(schema).includes('filterRemoveProduct'));
  const validate = ajv.compile(inputSchema(endpoint, true));
  assert.ok(validate({ body: endpoint.bodyExample }));
  const tasks = snapshot.sources.config.endpoints.find((e) => e.id === 'ozon-review-analyse-task-add')!;
  const validateTasks = ajv.compile(inputSchema(tasks));
  assert.ok(validateTasks({ apiKey: 'key-one', body: { skus: ['123'] } }));
  assert.equal(validateTasks({ apiKey: 'key-one', body: { skus: [123] } }), false);
  assert.equal(validateTasks({ apiKey: 'key-one', body: { skus: [null] } }), false);
});

test('无示例的对象数组仍校验元素类型及必填子字段', () => {
  const validate = ajv.compile(parametersSchema([
    { name: 'orders', docType: 'array', required: true },
    { name: 'orders.field', docType: 'string', required: true },
  ]));
  assert.ok(validate({ orders: [{ field: 'name' }] }));
  assert.equal(validate({ orders: ['name'] }), false);
  assert.equal(validate({ orders: [{}] }), false);
});

test('保存的工具清单与当前适配器生成结果一致', async () => {
  const catalog = JSON.parse(await readFile(`${ROOT}/api/catalog.json`, 'utf8'));
  assert.deepEqual(catalog, snapshot.sources.config.endpoints.map((e) => ({ id: e.id, name: toolName(e), inputSchema: inputSchema(e) })));
});

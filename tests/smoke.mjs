import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { io } from '../frontend/node_modules/socket.io-client/build/esm/index.js';
const port = 5100 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
const backend = spawn(process.execPath, ['server.js'], { cwd: new URL('../backend/', import.meta.url), env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
const clients = [];
const controller = new AbortController();
const deadline = setTimeout(() => { backend.kill(); process.exit(1); }, 20000);
async function api(path, method = 'GET', body) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: r.status === 204 ? null : await r.json() };
}
async function client() {
  const s = io(base, { transports: ['websocket'], forceNew: true });
  clients.push(s); await once(s, 'connect'); return s;
}
const ack = (s, event, data) => s.timeout(3000).emitWithAck(event, data);
try {
  await once(backend.stdout, 'data');
  assert.equal((await api('/health')).body.status, 'ok');
  assert.equal((await api('/api/v1/catalog')).body.data.length, 3);
  assert.equal((await api('/api/v1/orders', 'POST', { customer: {}, item: 'x' })).status, 400);
  const stream = await fetch(base + '/events', { signal: controller.signal });
  assert.match(stream.headers.get('content-type'), /text\/event-stream/);
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /SSE connection established/);
  const a = await client(), b = await client(), outsider = await client();
  assert.equal((await ack(a, 'joinRoom', { orderId: 'ORD-101', name: 'Ali', role: 'Customer' })).ok, true);
  assert.equal((await ack(b, 'joinRoom', { orderId: 'ORD-101', name: 'Agent', role: 'Support' })).ok, true);
  assert.equal((await ack(outsider, 'joinRoom', { orderId: 'ORD-101', name: 'Extra', role: 'Customer' })).ok, false);
  assert.equal((await ack(outsider, 'sendMessage', { orderId: 'ORD-101', message: 'unauthorized' })).ok, false);
  const received = once(b, 'receiveMessage');
  await ack(a, 'sendMessage', { orderId: 'ORD-101', message: 'Where is my order?', sender: 'Fake name' });
  const [message] = await received;
  assert.equal(message.message, 'Where is my order?');
  assert.equal(message.sender, 'Ali (Customer)');
  const changed = once(a, 'orderStatusUpdate');
  assert.equal((await api('/api/v1/orders/ORD-101/status', 'PATCH', { status: 'Shipped' })).status, 200);
  assert.equal((await changed)[0].status, 'Shipped');
  assert.match(new TextDecoder().decode((await reader.read()).value), /status changed to Shipped/);
  const create = await api('/api/v1/orders', 'POST', { customer: 'Tester', item: 'Gaming Mouse' });
  assert.equal(create.status, 201);
  const rpc = await api('/rpc', 'POST', { jsonrpc: '2.0', method: 'cancelOrder', params: { orderId: create.body.data.id }, id: 7 });
  assert.equal(rpc.body.id, 7); assert.equal(rpc.body.result.order.status, 'Cancelled');
  assert.equal((await api('/rpc', 'POST', { jsonrpc: '2.0', method: 'unknown', id: 1 })).body.error.code, -32601);
  assert.equal((await api('/rpc', 'POST', { jsonrpc: '2.0', method: 'cancelOrder', params: {}, id: 2 })).body.error.code, -32602);
  assert.equal((await api('/rpc', 'POST', null)).body.error.code, -32600);
  assert.equal((await api('/rpc', 'POST', { jsonrpc: '2.0', method: 'cancelOrder', params: ['ORD-102'] })).status, 204);
  const batch = await api('/rpc', 'POST', [{ jsonrpc: '2.0', method: 'unknown' }, { jsonrpc: '2.0', method: 'unknown', id: 3 }]);
  assert.equal(batch.body.length, 1); assert.equal(batch.body[0].id, 3);
  const malformed = await fetch(base + '/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal((await malformed.json()).error.code, -32700);
  console.log('PASS: REST, actual WebSocket transport, room membership, chat, status broadcast, SSE, RPC success/errors/notifications/batch/parse errors.');
} finally {
  clearTimeout(deadline); controller.abort(); clients.forEach(s => s.disconnect()); backend.kill();
}

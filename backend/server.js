import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server } from 'socket.io';

dotenv.config();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: '32kb', strict: false }));
const io = new Server(server, { cors: { origin: CLIENT_URL }, maxHttpBufferSize: 32768 });
const catalog = [
  { id: 1, name: 'Wireless Headphones', price: 7500 },
  { id: 2, name: 'Smart Watch', price: 12000 },
  { id: 3, name: 'Gaming Mouse', price: 4500 }
];
const orders = [
  { id: 'ORD-101', customer: 'Ali', item: 'Wireless Headphones', status: 'Processing' },
  { id: 'ORD-102', customer: 'Sara', item: 'Smart Watch', status: 'Shipped' }
];
const sseClients = new Set();
const isText = (s, max) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
const getOrder = id => orders.find(o => o.id === id);
const terminal = o => ['Delivered', 'Cancelled'].includes(o.status);
function broadcastAlert(message, type = 'info') {
  const data = `data: ${JSON.stringify({ message, type, time: new Date().toISOString() })}\n\n`;
  for (const client of sseClients) client.write(data);
}
function publishOrder(order, message) {
  // Status updates reach all demo dashboards. Chat is scoped to an order room.
  io.emit('orderStatusUpdate', order);
  broadcastAlert(message);
}
io.on('connection', socket => {
  socket.on('joinRoom', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const { orderId, role, name } = data || {};
    if (!getOrder(orderId) || !['Customer', 'Support'].includes(role) || !isText(name, 60)) {
      return reply({ ok: false, error: 'Choose an existing order, role and name (max 60 characters).' });
    }
    const room = `order-${orderId}`;
    for (const id of io.sockets.adapter.rooms.get(room) || []) {
      if (id !== socket.id && io.sockets.sockets.get(id)?.data.role === role) {
        return reply({ ok: false, error: `A ${role} is already in this room. Choose the other role or another order.` });
      }
    }
    if (socket.data.orderId) socket.leave(`order-${socket.data.orderId}`);
    socket.join(room);
    Object.assign(socket.data, { orderId, role, name: name.trim() });
    reply({ ok: true, orderId });
    io.to(room).emit('systemMessage', { message: `${name.trim()} (${role}) joined`, time: new Date().toISOString() });
  });
  socket.on('leaveRoom', () => {
    if (socket.data.orderId) socket.leave(`order-${socket.data.orderId}`);
    socket.data = {};
  });
  socket.on('sendMessage', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const { orderId, message } = data || {};
    if (!orderId || socket.data.orderId !== orderId || !socket.rooms.has(`order-${orderId}`)) return reply({ ok: false, error: 'Join this order room first.' });
    if (!isText(message, 1000)) return reply({ ok: false, error: 'Message must be 1–1000 characters.' });
    io.to(`order-${orderId}`).emit('receiveMessage', { orderId, message: message.trim(), sender: `${socket.data.name} (${socket.data.role})`, time: new Date().toISOString() });
    reply({ ok: true });
  });
});
app.get('/', (req, res) => res.json({ message: 'Order Tracking & Live Support API is running', endpoints: ['/api/v1/orders', '/api/v1/catalog', '/rpc', '/events'] }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/v1/catalog', (req, res) => res.json({ success: true, data: catalog }));
app.get('/api/v1/orders', (req, res) => res.json({ success: true, data: orders }));
app.get('/api/v1/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  res.json({ success: true, data: order });
});
app.post('/api/v1/orders', (req, res) => {
  const { customer, item } = req.body || {};
  if (!isText(customer, 60) || !catalog.some(p => p.name === item)) return res.status(400).json({ message: 'Enter a customer name (max 60 characters) and a catalog item.' });
  const order = { id: `ORD-${randomUUID().slice(0, 8)}`, customer: customer.trim(), item, status: 'Processing' };
  orders.push(order);
  publishOrder(order, `New order ${order.id} created`);
  res.status(201).json({ success: true, data: order });
});
app.patch('/api/v1/orders/:id/status', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) return res.status(404).json({ message: 'Order not found' });
  const status = req.body?.status;
  if (!['Shipped', 'Delivered'].includes(status)) return res.status(400).json({ message: 'Status must be Shipped or Delivered.' });
  if (terminal(order)) return res.status(409).json({ message: 'This order is already completed or cancelled.' });
  if (status === 'Delivered' && order.status !== 'Shipped') return res.status(409).json({ message: 'Ship this order before marking it delivered.' });
  order.status = status;
  publishOrder(order, `${order.id} status changed to ${status}`);
  res.json({ success: true, data: order });
});
const rpcError = (code, message, id = null) => ({ jsonrpc: '2.0', error: { code, message }, id });
function processRpc(body) {
  const object = body !== null && typeof body === 'object' && !Array.isArray(body);
  const hasId = object && Object.hasOwn(body, 'id');
  const validId = !hasId || body.id === null || ['string', 'number'].includes(typeof body.id);
  const validParams = object && (!Object.hasOwn(body, 'params') || (body.params !== null && typeof body.params === 'object'));
  if (!object || body.jsonrpc !== '2.0' || typeof body.method !== 'string' || !validId || !validParams) return rpcError(-32600, 'Invalid Request');
  const respond = value => hasId ? value : undefined;
  if (body.method !== 'cancelOrder') return respond(rpcError(-32601, 'Method not found', body.id));
  const orderId = Array.isArray(body.params) ? body.params[0] : body.params?.orderId;
  if (!isText(orderId, 100)) return respond(rpcError(-32602, 'Invalid params: orderId is required', body.id));
  const order = getOrder(orderId);
  if (!order) return respond(rpcError(-32004, 'Order not found', body.id));
  if (order.status === 'Delivered') return respond(rpcError(-32009, 'Delivered orders cannot be cancelled', body.id));
  order.status = 'Cancelled';
  publishOrder(order, `${order.id} was cancelled using JSON-RPC`);
  return respond({ jsonrpc: '2.0', result: { success: true, order: { ...order } }, id: body.id });
}
app.post('/rpc', (req, res) => {
  let result;
  if (Array.isArray(req.body)) {
    result = req.body.length ? req.body.map(processRpc).filter(r => r !== undefined) : rpcError(-32600, 'Invalid Request');
    if (Array.isArray(result) && !result.length) return res.status(204).end();
  } else result = processRpc(req.body);
  if (result === undefined) return res.status(204).end();
  res.json(result);
});
app.get('/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  res.write(`retry: 3000\ndata: ${JSON.stringify({ message: 'SSE connection established', type: 'success', time: new Date().toISOString() })}\n\n`);
  sseClients.add(res);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 20000);
  res.on('close', () => { clearInterval(heartbeat); sseClients.delete(res); });
});
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json(req.path === '/rpc' ? rpcError(-32700, 'Parse error') : { message: 'Invalid JSON' });
  console.error(err.message);
  res.status(err.status || 500).json({ message: 'Request failed' });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

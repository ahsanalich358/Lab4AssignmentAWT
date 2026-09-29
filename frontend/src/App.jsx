import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

export default function App() {
  const [orders, setOrders] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState('ORD-101');
  const [role, setRole] = useState('Customer');
  const [name, setName] = useState('Ali');
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [rpcResult, setRpcResult] = useState('');

  const [catalog, setCatalog] = useState([]);
  const [customer, setCustomer] = useState('');
  const [item, setItem] = useState('Wireless Headphones');
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const socketRef = useRef(null);
  const membership = useRef(null);

  const request = async (path, method = 'GET', body) => {
    const res = await fetch(`${API}${path}`, {
      method, headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Request failed');
    return json;
  };
  const loadOrders = async () => {
    try { setOrders((await request('/api/v1/orders')).data); }
    catch { setError('Cannot reach the backend. Check the backend terminal or deployment URL, then click Refresh.'); }
  };
  useEffect(() => {
    loadOrders();
    request('/api/v1/catalog').then(j => setCatalog(j.data)).catch(() => setError('Cannot load catalog. Check the backend connection.'));
    const events = new EventSource(`${API}/events`);
    events.onopen = () => setSseConnected(true);
    events.onerror = () => setSseConnected(false);
    events.onmessage = event => setAlerts(prev => [JSON.parse(event.data), ...prev].slice(0, 12));
    const socket = io(API, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      setConnected(true);
      loadOrders();
      if (membership.current) socket.emit('joinRoom', membership.current, result => {
        setJoined(result.ok);
        if (!result.ok) setError(result.error);
      });
    });
    socket.on('disconnect', () => { setConnected(false); setJoined(false); });
    socket.on('connect_error', () => setConnected(false));
    socket.on('receiveMessage', data => setChat(prev => [...prev, data].slice(-100)));
    socket.on('systemMessage', data => setChat(prev => [...prev, { ...data, sender: 'System' }].slice(-100)));
    socket.on('orderStatusUpdate', order => setOrders(prev => prev.some(o => o.id === order.id) ? prev.map(o => o.id === order.id ? order : o) : [...prev, order]));
    return () => { events.close(); socket.removeAllListeners(); socket.disconnect(); socketRef.current = null; };
  }, []);

  const leaveRoom = () => {
    socketRef.current?.emit('leaveRoom');
    membership.current = null;
    setJoined(false);
    setChat([]);
  };
  const joinRoom = () => {
    if (!connected) return setError('Wait for the WebSocket connection.');
    const data = { orderId: selectedOrder, role, name };
    socketRef.current.timeout(5000).emit('joinRoom', data, (err, result) => {
      if (err || !result.ok) return setError(err ? 'Room join timed out. Try again.' : result.error);
      membership.current = data;
      setJoined(true);
      setError('');
    });
  };
  const sendMessage = () => {
    if (!joined || !connected || !message.trim()) return;
    socketRef.current.timeout(5000).emit('sendMessage', { orderId: selectedOrder, message }, (err, result) => {
      if (err || !result.ok) return setError(err ? 'Message timed out. Please reconnect.' : result.error);
      setMessage('');
    });
  };
  const changeStatus = async (orderId, status) => {
    try { await request(`/api/v1/orders/${orderId}/status`, 'PATCH', { status }); setError(''); }
    catch (e) { setError(e.message); }
  };
  const cancelOrder = async orderId => {
    try {
      const json = await request('/rpc', 'POST', { jsonrpc: '2.0', method: 'cancelOrder', params: { orderId }, id: Date.now() });
      setRpcResult(JSON.stringify(json, null, 2));
      setError(json.error?.message || '');
    } catch (e) { setError(e.message); }
  };
  const createOrder = async event => {
    event.preventDefault();
    try {
      await request('/api/v1/orders', 'POST', { customer, item });
      setCustomer(''); setError('');
    } catch (e) { setError(e.message); }
  };

  return (
    <main className="page">
      <header>
        <h1>Order Tracking & Live Support System</h1>
        <p>REST + WebSockets + JSON-RPC 2.0 + Server-Sent Events</p>
        <p className="connections">WebSocket: {connected ? 'Connected' : 'Connecting…'} · SSE: {sseConnected ? 'Connected' : 'Reconnecting…'}</p>
        <small>Classroom demo · Data resets when the server restarts</small>
      </header>
      {error && <div className="error" role="alert">{error} <button onClick={() => setError('')}>Dismiss</button></div>}
      <section className="card">
        <h2>Create an order</h2>
        <form onSubmit={createOrder}>
          <label htmlFor="customer">Customer name</label>
          <input id="customer" required maxLength={60} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Enter customer name" />
          <label htmlFor="product">Catalog</label>
          <select id="product" value={item} onChange={e => setItem(e.target.value)}>
            {catalog.map(p => <option key={p.id} value={p.name}>{p.name} — PKR {p.price.toLocaleString()}</option>)}
          </select>
          <button disabled={!catalog.length}>Create Order</button>
        </form>
      </section>

      <section className="card">
        <h2>1. Orders — REST API</h2><button onClick={loadOrders}>Refresh</button>
        <div className="orders">
          {orders.map((order) => (
            <div className="order" key={order.id}>
              <div>
                <strong>{order.id}</strong>
                <p>{order.customer} — {order.item}</p>
                <span className="badge">{order.status}</span>
              </div>
              <div className="actions">
                <button disabled={order.status !== 'Processing'} onClick={() => changeStatus(order.id, 'Shipped')}>Mark Shipped</button>
                <button disabled={order.status !== 'Shipped'} onClick={() => changeStatus(order.id, 'Delivered')}>Mark Delivered</button>
                <button disabled={['Cancelled', 'Delivered'].includes(order.status)} className="danger" onClick={() => cancelOrder(order.id)}>Cancel via RPC</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid">
        <div className="card">
          <h2>2. Live Support — Socket.io</h2>
          <label>Order</label>
          <select value={selectedOrder} onChange={(e) => { leaveRoom(); setSelectedOrder(e.target.value); }}>
            {orders.map((o) => <option key={o.id}>{o.id}</option>)}
          </select>

          <label>Role</label>
          <select value={role} onChange={(e) => { leaveRoom(); setRole(e.target.value); }}>
            <option>Customer</option>
            <option>Support</option>
          </select>

          <label>Name</label>
          <input maxLength={60} value={name} onChange={(e) => { leaveRoom(); setName(e.target.value); }} />
          <button disabled={!connected || joined} onClick={joinRoom}>{joined ? 'Joined Room' : 'Join Chat Room'}</button> {joined && <button onClick={leaveRoom}>Leave Room</button>}

          <div className="chatbox">
            {chat.map((m, i) => (
              <div key={i}><b>{m.sender}:</b> {m.message}</div>
            ))}
          </div>

          <div className="sendrow">
            <input disabled={!joined || !connected} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type message..." onKeyDown={(e) => e.key === 'Enter' && sendMessage()} />
            <button disabled={!joined || !connected || !message.trim()} onClick={sendMessage}>Send</button>
          </div>
        </div>

        <div className="card">
          <h2>3. Live Alerts — SSE</h2>
          <div className="alerts">
            {alerts.map((a, i) => (
              <div className="alert" key={i}>
                <strong>{a.type?.toUpperCase()}</strong>
                <div>{a.message}</div>
                <small>{new Date(a.time).toLocaleTimeString()}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>4. JSON-RPC Response</h2>
        <pre>{rpcResult || 'Click “Cancel via RPC” on any order.'}</pre>
      </section>
    </main>
  );
}

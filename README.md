# Real-Time Order Tracking & Live Support System

**CSC337 — Lab Assignment 04**

A React and Node.js application for managing orders, tracking live status updates, chatting with support, and receiving alerts.

## Live Links

- **Frontend:** https://lab4-assignment-awt.vercel.app/
- **Backend:** https://lab4assignmentawt.onrender.com
- **Health check:** https://lab4assignmentawt.onrender.com/health

## Protocols and Features

| Protocol | Purpose |
| --- | --- |
| REST API | Load products, create orders, and update status. |
| Socket.io WebSockets | Real-time order updates and customer/support chat. |
| JSON-RPC 2.0 | Cancel orders through the `cancelOrder` method. |
| SSE | Push live order and system alerts. |

**Stack:** React, Vite, CSS, Node.js, Express, Socket.io, Fetch API, and EventSource.

## Project Structure

```text
project-root/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example
├── tests/
│   └── smoke.mjs
├── screenshots/
│   ├── dashboard.png
│   ├── orders.png
│   ├── chat-sse.png
│   └── json-rpc.png
├── .gitignore
└── README.md
```

## Local Setup

Install Node.js and npm. Create these environment files before starting:

**`backend/.env`:**

```env
PORT=5000
CLIENT_URL=http://localhost:5173
```

**`frontend/.env`:**

```env
VITE_API_URL=http://localhost:5000
```

In the first terminal, from the project root:

```bash
cd backend
npm install
npm run dev
```

In a second terminal, from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Keep both terminals running.

## REST API

Base URL: `https://lab4assignmentawt.onrender.com`

| Method | Endpoint | Action |
| --- | --- | --- |
| GET | `/health` | Check server health |
| GET | `/api/v1/catalog` | List products |
| GET | `/api/v1/orders` | List orders |
| GET | `/api/v1/orders/:id` | Get one order |
| POST | `/api/v1/orders` | Create an order |
| PATCH | `/api/v1/orders/:id/status` | Mark Shipped or Delivered |

Create-order request (`Content-Type: application/json`):

```json
{"customer":"Ali","item":"Gaming Mouse"}
```

Order flow: **Processing → Shipped → Delivered**. Eligible orders can also be cancelled through JSON-RPC.

## WebSocket Events

| Event | Direction | Data / purpose |
| --- | --- | --- |
| `joinRoom` | Client → Server | `{ orderId, role, name }` |
| `leaveRoom` | Client → Server | Leave the current chat room |
| `sendMessage` | Client → Server | `{ orderId, message }` |
| `receiveMessage` | Server → Room | `{ orderId, message, sender, time }` |
| `systemMessage` | Server → Room | `{ message, time }` |
| `orderStatusUpdate` | Server → All clients | Updated order object |

Rooms use `order-<orderId>` and allow one **Customer** and one **Support** participant. Chat stays within its room; order updates reach all dashboards. Join and send actions acknowledge success or return an error.

## JSON-RPC 2.0

Send `POST /rpc` with an existing order ID:

```json
{
  "jsonrpc": "2.0",
  "method": "cancelOrder",
  "params": { "orderId": "ORD-a7084a3a" },
  "id": 1790714910315
}
```

Response captured in the supplied screenshot:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "order": {
      "id": "ORD-a7084a3a",
      "customer": "Ali",
      "item": "Gaming Mouse",
      "status": "Cancelled"
    }
  },
  "id": 1790714910315
}
```

## Server-Sent Events

`GET /events` opens an EventSource stream. Alerts contain `message`, `type`, and `time`, covering order creation, status changes, and cancellations.

## Deployment Settings

| Setting | Render backend | Vercel frontend |
| --- | --- | --- |
| Root directory | `backend` | `frontend` |
| Install / build | `npm install` | `npm install`, then `npm run build` |
| Start / output | `npm start` | `dist` |
| Variable | `CLIENT_URL=https://lab4-assignment-awt.vercel.app` | `VITE_API_URL=https://lab4assignmentawt.onrender.com` |

Redeploy after changing environment variables. Render provides the server port automatically.

## Output Screenshots

### Dashboard

Catalog loaded with WebSocket and SSE connected.

![Dashboard with connected WebSocket and SSE](screenshots/dashboard.png)

### Orders — REST API

Orders with shipping, delivery, and cancellation actions.

![Order list and status actions](screenshots/orders.png)

### Live Support and SSE

Support chat alongside live status and cancellation alerts.

![Support chat and live SSE alerts](screenshots/chat-sse.png)

### JSON-RPC Response

Successful cancellation using `cancelOrder`.

![JSON-RPC cancellation response](screenshots/json-rpc.png)

## Quick Test

1. Create an order and update its status.
2. Open two browser windows and join the same order as Customer and Support.
3. Exchange messages and observe live alerts.
4. Cancel another order using **Cancel via RPC** and inspect the result.

After installing both folders' dependencies, run checks from the project root:

```bash
node tests/smoke.mjs
npm run build --prefix frontend
```

## Notes

- In-memory data resets when the backend restarts.
- A sleeping free backend may respond slowly to the first request.
- This classroom demo has no production authentication; do not use real customer data.
- Do not upload `node_modules` or real `.env` files.

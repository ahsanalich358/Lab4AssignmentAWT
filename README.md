# Real-Time Order Tracking & Live Support System by Ahsan Ali (SP24-BSE-004)

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

(<img width="955" height="455" alt="dashboard" src="https://github.com/user-attachments/assets/68cf7320-f459-4c2c-b149-48a83ec0aff9" />
)

### Orders — REST API

Orders with shipping, delivery, and cancellation actions.

(<img width="794" height="439" alt="orders" src="https://github.com/user-attachments/assets/1ec0f49f-87f9-42a7-aabd-33d6c704b57c" />
)

### Live Support and SSE

Support chat alongside live status and cancellation alerts.

(<img width="800" height="435" alt="chat-sse" src="https://github.com/user-attachments/assets/50f5cae3-4912-4bb7-a853-8bc4f19bc12d" />
)

### JSON-RPC Response

Successful cancellation using `cancelOrder`.

(<img width="862" height="458" alt="json-rpc" src="https://github.com/user-attachments/assets/d4255b3b-912e-4cef-bf6a-b4558c4a689e" />
)



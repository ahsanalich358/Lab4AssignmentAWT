# Lab Assignment 04: Real-Time Order Tracker & Live Support

React/Vite frontend and Node.js/Express backend demonstrating REST, Socket.io WebSockets, JSON-RPC 2.0 and Server-Sent Events.

## Submission links — replace after deployment

- Public GitHub repository: ADD YOUR URL
- Frontend (Vercel): ADD YOUR URL
- Backend (Render): ADD YOUR URL
- Backend health: YOUR BACKEND URL/health

The source is ready to run; these placeholders are not live deployments.

## Requirements and features

| Requirement | Implementation |
| --- | --- |
| Resource management | REST catalog, create/list/read orders and change status |
| WebSockets | Actual WebSocket transport via Socket.io; instant order updates and per-order Customer/Support chat |
| JSON-RPC 2.0 | `POST /rpc`, `cancelOrder`, request IDs, errors, notifications and batches |
| SSE | `GET /events`, EventSource live system alerts, heartbeat and automatic reconnect |
| Frontend | Catalog, order form, order list, status controls, chat, alerts, RPC response |
| Deployment | Separate Render backend and Vercel frontend; instructions below |

## Quick start

Install Node.js 22 LTS or newer, then open this folder in VS Code. Use two terminals.

Terminal 1:

```sh
cd backend
npm install
npm run dev
```

Terminal 2 (start from the project root):

```sh
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Backend health: http://localhost:5000/health.
Local defaults work without creating `.env` files. For customized settings, copy each `.env.example` to `.env` in the same folder. Do not commit `.env` files.

## Project files

- `backend/server.js`: HTTP REST/RPC/SSE routes, validation, Socket.io events and demo data.
- `backend/package.json`, `package-lock.json`: server scripts/dependencies.
- `frontend/src/App.jsx`: dashboard and all protocol clients.
- `frontend/src/styles.css`: responsive styling.
- `frontend/src/main.jsx`, `index.html`, `vite.config.js`: React/Vite entry and build setup.
- `frontend/package.json`, `package-lock.json`: frontend dependencies.
- `.env.example` in each app: environment configuration examples.
- `tests/smoke.mjs`: integration check using an isolated backend process.
- `STEP-BY-STEP-ROMAN-URDU.md`: beginner setup, GitHub, hosting and submission instructions.
- `.gitignore`: excludes dependencies, private environment files and build output.

## REST API

| Method | Route | Body / purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/api/v1/catalog` | Available products with PKR prices |
| GET | `/api/v1/orders` | List orders |
| GET | `/api/v1/orders/:id` | Read one order |
| POST | `/api/v1/orders` | `{"customer":"Ahmad","item":"Gaming Mouse"}` |
| PATCH | `/api/v1/orders/:id/status` | `{"status":"Shipped"}` or `{"status":"Delivered"}` |

Orders start in Processing, then move to Shipped and Delivered. Cancelled/Delivered orders cannot be changed; delivered orders cannot be cancelled. Validation failures return 400, missing orders 404 and conflicting state changes 409.

## WebSocket event contract

Socket.io shares the backend HTTP server/port. The frontend requests `transports: ['websocket']`. Status updates reach every connected demo dashboard; chat messages go only to the joined order room.

| Direction | Event | Payload / behavior |
| --- | --- | --- |
| Client → server | `joinRoom` | `{orderId, role, name}`; role is Customer or Support; acknowledgement `{ok, error?}` |
| Client → server | `leaveRoom` | No payload; clears membership |
| Client → server | `sendMessage` | `{orderId, message}`; acknowledgement `{ok, error?}` |
| Server → client | `receiveMessage` | `{orderId, message, sender, time}` |
| Server → client | `systemMessage` | `{message, time}` |
| Server → client | `orderStatusUpdate` | Complete created/updated order |

Rooms are named `order-<orderId>`, e.g. `order-ORD-101`. Each room accepts one Customer socket and one Support socket. Changing name/role/order leaves the old room. Reconnection attempts to rejoin the last room. Names are server-derived from joined membership when sending messages. Messages require current membership and are limited to 1,000 characters.

## JSON-RPC 2.0

POST `/rpc` with Content-Type `application/json`:

```json
{"jsonrpc":"2.0","method":"cancelOrder","params":{"orderId":"ORD-101"},"id":1}
```

Successful response:

```json
{"jsonrpc":"2.0","result":{"success":true,"order":{"id":"ORD-101","customer":"Ali","item":"Wireless Headphones","status":"Cancelled"}},"id":1}
```

`params: ["ORD-101"]` also works. A request without `id` is a notification and receives HTTP 204 with no JSON-RPC response body. Batch arrays return only responses for requests with IDs. Empty batch is invalid. Error codes: -32700 parse error, -32600 invalid request, -32601 unknown method, -32602 invalid parameters, -32004 missing order, -32009 delivered order cancellation.

## Server-Sent Events

GET `/events` returns `text/event-stream`. Unnamed `data:` events contain `{message,type,time}` and are consumed through `EventSource.onmessage`. Order creation/status changes/cancellation trigger alerts. Comment heartbeats every 20 seconds keep the stream active; disconnection removes the client and timer. The browser retries automatically; there is no persisted event replay.

## Test and build

Install both apps' dependencies first. From the project root:

```sh
node tests/smoke.mjs
```

The test starts and stops its own backend on a temporary port. It verifies REST validation/creation, actual WebSocket connections, two-role chat, membership checks, order broadcasts, SSE delivery, RPC success/errors/notifications/batch handling and malformed JSON.

Frontend production build:

```sh
cd frontend
npm run build
```

Manual demo: open two browser windows. Join ORD-101 as Customer in A and Support in B; send messages both ways. Mark Shipped and watch the second window update without refresh. Create a new order, cancel it via RPC, and check the response and live SSE alert. Choose another order to demonstrate chat isolation. Browser DevTools Network shows the WebSocket connection and `/events` stream.

## Public GitHub repository

Create an empty public repository named `order-tracking-live-support`. From this project root:

```sh
git init
git add .
git commit -m "Complete Lab Assignment 04"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/order-tracking-live-support.git
git push -u origin main
```

Replace YOUR-USERNAME. Use GitHub's normal sign-in flow. Never place an account password or token in source. The repository root must contain `backend`, `frontend` and README.md, not the ZIP itself.

## Deploy backend on Render

Create a Web Service from the public GitHub repository.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Root Directory | `backend` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Environment variable | `CLIENT_URL=http://localhost:5173` initially |

Render supplies PORT. Once deployed, open its `/health` and `/api/v1/orders` routes. Copy your actual `https://...onrender.com` base URL. After frontend deployment, change CLIENT_URL to its exact production origin with no trailing slash, and redeploy the backend.

## Deploy frontend on Vercel

Import the same GitHub repository.

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment variable | `VITE_API_URL=https://YOUR-ACTUAL-BACKEND.onrender.com` |

Set VITE_API_URL before building. Redeploy whenever it changes. Do not include `/api`, `/events` or a trailing slash in the base URL. Update Render's CLIENT_URL after obtaining the production Vercel URL. Ensure the production frontend is publicly accessible without a Vercel login/deployment protection challenge.

## Limitations relevant to the lab

This is an educational, single-instance demo. Orders and chat are not stored in a database; orders reset to the two sample records on server restart. Chat history is kept only in each browser's current component state. Roles are self-selected for demonstration, not authenticated; all visitors can see demo orders and use status controls. Use synthetic data. A production service would add authentication/authorization, database storage, rate limits and shared state for multiple server instances.

Render Free services may sleep after 15 idle minutes and need about a minute to start on a new request. Reopen the backend health URL and wait before the demonstration. Verify all three public URLs in an incognito window before submission; do not submit placeholders.

## Official references

- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/websocket
- https://render.com/docs/free
- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/environment-variables/managing-environment-variables
- https://www.jsonrpc.org/specification

import express from 'express';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { DiscoveryService } from './discovery.ts';
import type { ControlPlaneMessage } from './types.ts';

const app = express();
const port = 3000;

app.use(express.static(path.join(import.meta.dirname, '../public')));

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const discovery = new DiscoveryService();

function broadcast(msg: ControlPlaneMessage): void {
    const data = JSON.stringify(msg);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    }
}

wss.on('connection', (ws: WebSocket) => {
    const msg: ControlPlaneMessage = {
        type: 'device_list',
        devices: discovery.getDevices(),
    };
    ws.send(JSON.stringify(msg));
});

discovery.on('device_found', (device) => {
    broadcast({ type: 'device_found', device });
});

discovery.on('device_lost', (deviceId: string) => {
    broadcast({ type: 'device_lost', deviceId });
});

discovery.start();

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

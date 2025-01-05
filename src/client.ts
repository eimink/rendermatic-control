import WebSocket from 'ws';
import { ControlCommand, ServerResponse } from './types';

class ControlClient {
    private ws: WebSocket;
    private textureList: string[] = [];
    private onTexturesUpdated: ((textures: string[]) => void) | null = null;

    constructor(private serverUrl: string) {
        this.ws = new WebSocket(serverUrl);
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.ws.on('open', () => {
            console.log('Connected to server');
        });

        this.ws.on('message', (data: string) => {
            const response = JSON.parse(data) as ServerResponse;
            console.log('Received:', response);
            
            if (response.command === 'list_textures' && response.textures) {
                this.textureList = response.textures;
                this.onTexturesUpdated?.(this.textureList);
            }
            else if (response.command === 'scan_textures_response' && response.textures) {
                this.textureList = response.textures;
                this.onTexturesUpdated?.(this.textureList);
            }
        });

        this.ws.on('error', (error: Error) => {
            console.error('WebSocket error:', error);
        });

        this.ws.on('close', () => {
            console.log('Disconnected from server');
        });
    }

    public sendCommand(command: ControlCommand) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(command));
        } else {
            console.error('WebSocket is not connected');
        }
    }

    public setTexturesCallback(callback: (textures: string[]) => void) {
        this.onTexturesUpdated = callback;
    }

    public refreshTextures() {
        this.sendCommand({ command: 'scan_textures' });
    }

    public loadTexture(texture: string) {
        this.sendCommand({ command: 'load_texture', texture });
    }

    public setTexture(texture: string) {
        this.sendCommand({ command: 'set_texture', texture });
    }
}

// Export for browser
(window as any).ControlClient = ControlClient;

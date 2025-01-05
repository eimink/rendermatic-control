import { ControlCommand, ServerResponse } from './types';

export class ControlClient {
    private ws: WebSocket;
    private textureList: string[] = [];
    private onTexturesUpdated: ((textures: string[]) => void) | null = null;

    constructor(private serverUrl: string) {
        this.ws = new WebSocket(serverUrl);
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        this.ws.onopen = () => {
            console.log('Connected to server');
            document.body.classList.remove('disconnected');
        };

        this.ws.onmessage = (event) => {
            const response = JSON.parse(event.data) as ServerResponse;
            console.log('Received:', response);
            
            if (response.command === 'texture_list' && response.textures) {
                this.textureList = response.textures;
                this.onTexturesUpdated?.(this.textureList);
            }
            else if (response.command === 'scan_textures_response' && response.textures) {
                this.textureList = response.textures;
                this.onTexturesUpdated?.(this.textureList);
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('Disconnected from server');
            document.body.classList.add('disconnected');
        };
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

// Make ControlClient available globally
(window as any).ControlClient = ControlClient;

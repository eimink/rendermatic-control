import type { ControlCommand, ServerResponse, DiscoveredDevice, ControlPlaneMessage } from './types.ts';

// --- DiscoveryClient: connects to the control-plane WebSocket on the Express server ---

export class DiscoveryClient {
    private ws: WebSocket | null = null;
    private devices: Map<string, DiscoveredDevice> = new Map();
    private onDeviceFound: ((device: DiscoveredDevice) => void) | null = null;
    private onDeviceLost: ((deviceId: string) => void) | null = null;
    private onDeviceList: ((devices: DiscoveredDevice[]) => void) | null = null;
    private onConnectionChange: ((connected: boolean) => void) | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private url: string;

    constructor(url: string) {
        this.url = url;
        this.connect();
    }

    private connect(): void {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
            this.onConnectionChange?.(true);
        };

        this.ws.onmessage = (event) => {
            const msg = JSON.parse(event.data as string) as ControlPlaneMessage;

            if (msg.type === 'device_list') {
                this.devices.clear();
                for (const device of msg.devices) {
                    this.devices.set(device.id, device);
                }
                this.onDeviceList?.(msg.devices);
            } else if (msg.type === 'device_found') {
                this.devices.set(msg.device.id, msg.device);
                this.onDeviceFound?.(msg.device);
            } else if (msg.type === 'device_lost') {
                this.devices.delete(msg.deviceId);
                this.onDeviceLost?.(msg.deviceId);
            }
        };

        this.ws.onerror = () => {};

        this.ws.onclose = () => {
            this.onConnectionChange?.(false);
            this.scheduleReconnect();
        };
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, 3000);
    }

    setDeviceFoundCallback(cb: (device: DiscoveredDevice) => void): void {
        this.onDeviceFound = cb;
    }

    setDeviceLostCallback(cb: (deviceId: string) => void): void {
        this.onDeviceLost = cb;
    }

    setDeviceListCallback(cb: (devices: DiscoveredDevice[]) => void): void {
        this.onDeviceList = cb;
    }

    setConnectionCallback(cb: (connected: boolean) => void): void {
        this.onConnectionChange = cb;
    }

    getDevices(): DiscoveredDevice[] {
        return Array.from(this.devices.values());
    }
}

// --- DeviceClient: connects directly to a rendermatic device ---

export class DeviceClient {
    private ws: WebSocket | null = null;
    private deviceId: string;
    private device: DiscoveredDevice;
    private handlers: Map<string, (response: ServerResponse) => void> = new Map();
    private onConnectionChange: ((connected: boolean) => void) | null = null;
    private authenticated: boolean = false;
    private authRequired: boolean = false;

    constructor(device: DiscoveredDevice) {
        this.device = device;
        this.deviceId = device.id;
        this.connect();
    }

    private connect(): void {
        this.ws = new WebSocket(`ws://${this.device.ip}:${this.device.port}`);

        this.ws.onopen = () => {
            this.onConnectionChange?.(true);
        };

        this.ws.onmessage = (event) => {
            const response = JSON.parse(event.data as string) as ServerResponse;

            // Track auth state from server messages
            if (response.command === 'auth_status') {
                this.authRequired = response.authRequired ?? false;
                this.authenticated = response.authenticated;
            } else if (response.command === 'auth_response' && response.success) {
                this.authenticated = true;
            }

            const handler = this.handlers.get(response.command);
            if (handler) {
                handler(response);
            }
        };

        this.ws.onerror = () => {};

        this.ws.onclose = () => {
            this.authenticated = false;
            this.onConnectionChange?.(false);
        };
    }

    sendCommand(command: ControlCommand): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(command));
        }
    }

    on(responseCommand: string, callback: (response: any) => void): void {
        this.handlers.set(responseCommand, callback);
    }

    setConnectionCallback(cb: (connected: boolean) => void): void {
        this.onConnectionChange = cb;
    }

    // Auth commands
    authenticate(key: string): void {
        this.sendCommand({ command: 'authenticate', key });
    }

    setAuthKey(key: string): void {
        this.sendCommand({ command: 'set_auth_key', key });
    }

    clearAuthKey(): void {
        this.sendCommand({ command: 'clear_auth_key' });
    }

    getAuthStatus(): void {
        this.sendCommand({ command: 'get_auth_status' });
    }

    // Device commands
    getDeviceInfo(): void {
        this.sendCommand({ command: 'get_device_info' });
    }

    setDeviceName(name: string): void {
        this.sendCommand({ command: 'set_device_name', name });
    }

    identify(duration?: number): void {
        this.sendCommand({ command: 'identify', duration });
    }

    // Texture commands
    scanTextures(): void {
        this.sendCommand({ command: 'scan_textures' });
    }

    listTextures(): void {
        this.sendCommand({ command: 'list_textures' });
    }

    loadTexture(texture: string): void {
        this.sendCommand({ command: 'load_texture', texture });
    }

    setTexture(texture: string): void {
        this.sendCommand({ command: 'set_texture', texture });
    }

    // Video commands
    playVideo(source: string, loop?: boolean): void {
        this.sendCommand({ command: 'play_video', source, loop });
    }

    stopVideo(): void {
        this.sendCommand({ command: 'stop_video' });
    }

    getVideoStatus(): void {
        this.sendCommand({ command: 'get_video_status' });
    }

    // Video file commands
    scanVideos(): void {
        this.sendCommand({ command: 'scan_videos' });
    }

    listVideos(): void {
        this.sendCommand({ command: 'list_videos' });
    }

    // Playlist commands
    setPlaylist(videos: string[], loop?: boolean): void {
        this.sendCommand({ command: 'set_playlist', videos, loop });
    }

    startPlaylist(index?: number): void {
        this.sendCommand({ command: 'start_playlist', index });
    }

    stopPlaylist(): void {
        this.sendCommand({ command: 'stop_playlist' });
    }

    nextVideo(): void {
        this.sendCommand({ command: 'next_video' });
    }

    prevVideo(): void {
        this.sendCommand({ command: 'prev_video' });
    }

    getPlaylistStatus(): void {
        this.sendCommand({ command: 'get_playlist_status' });
    }

    // State
    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }

    isAuthenticated(): boolean {
        return this.authenticated;
    }

    isAuthRequired(): boolean {
        return this.authRequired;
    }

    getDeviceId(): string {
        return this.deviceId;
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Make classes available globally for init.js
(window as any).DiscoveryClient = DiscoveryClient;
(window as any).DeviceClient = DeviceClient;

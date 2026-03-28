import { Bonjour, type Browser, type Service } from 'bonjour-service';
import { EventEmitter } from 'events';
import type { DiscoveredDevice } from './types.ts';

export class DiscoveryService extends EventEmitter {
    private bonjour: InstanceType<typeof Bonjour>;
    private browser: Browser | null = null;
    private devices: Map<string, DiscoveredDevice> = new Map();

    constructor() {
        super();
        this.bonjour = new Bonjour();
    }

    start(): void {
        const browser = this.bonjour.find({ type: 'rendermatic' });
        this.browser = browser;

        browser.on('up', (service: Service) => {
            const ip = this.extractIPv4(service);
            if (!ip) return;

            const port = service.port;
            const id = `${ip}:${port}`;
            const device: DiscoveredDevice = {
                id,
                instanceName: service.name,
                hostname: service.host,
                ip,
                port,
            };

            this.devices.set(id, device);
            this.emit('device_found', device);
        });

        browser.on('down', (service: Service) => {
            const ip = this.extractIPv4(service);
            if (!ip) return;

            const id = `${ip}:${service.port}`;
            if (this.devices.has(id)) {
                this.devices.delete(id);
                this.emit('device_lost', id);
            }
        });
    }

    stop(): void {
        if (this.browser) {
            this.browser.stop();
            this.browser = null;
        }
        this.bonjour.destroy();
    }

    getDevices(): DiscoveredDevice[] {
        return Array.from(this.devices.values());
    }

    private extractIPv4(service: Service): string | null {
        const addresses = service.addresses ?? [];
        const ipv4 = addresses.find((addr: string) => !addr.includes(':'));
        return ipv4 ?? (service.host || null);
    }
}

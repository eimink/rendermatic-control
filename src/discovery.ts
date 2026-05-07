import { Bonjour, type Browser, type Service } from 'bonjour-service';
import { EventEmitter } from 'events';
import type { DiscoveredDevice } from './types.ts';

const REFRESH_INTERVAL = 30_000;

export class DiscoveryService extends EventEmitter {
    private bonjour: InstanceType<typeof Bonjour>;
    private browser: Browser | null = null;
    private devices: Map<string, DiscoveredDevice> = new Map();
    private instanceToId: Map<string, string> = new Map();
    private refreshTimer: ReturnType<typeof setInterval> | null = null;

    constructor() {
        super();
        this.bonjour = new Bonjour();
    }

    start(): void {
        const browser = this.bonjour.find({ type: 'rendermatic' });
        this.browser = browser;

        browser.on('up', (service: Service) => this.handleUp(service));

        browser.on('down', (service: Service) => {
            const ip = this.extractIPv4(service);
            if (!ip) return;

            const id = `${ip}:${service.port}`;
            if (this.devices.has(id)) {
                this.devices.delete(id);
                this.instanceToId.delete(service.name);
                this.emit('device_lost', id);
            }
        });

        // Periodically clear the browser's internal cache and re-query.
        // bonjour-service tracks known services by fqdn and silently
        // ignores responses for already-known services when only the
        // address changed. Clearing the cache forces it to treat every
        // response as a new service, and our handleUp deduplicates.
        this.refreshTimer = setInterval(() => {
            const b = this.browser as any;
            b.serviceMap = {};
            b._services = [];
            browser.update();
        }, REFRESH_INTERVAL);
    }

    stop(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.browser) {
            this.browser.stop();
            this.browser = null;
        }
        this.bonjour.destroy();
    }

    getDevices(): DiscoveredDevice[] {
        return Array.from(this.devices.values());
    }

    private handleUp(service: Service): void {
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

        // If this instance was previously known under a different IP, remove the stale entry
        const prevId = this.instanceToId.get(service.name);
        if (prevId && prevId !== id && this.devices.has(prevId)) {
            this.devices.delete(prevId);
            this.emit('device_lost', prevId);
        }

        this.instanceToId.set(service.name, id);

        // Only emit if this is a new device or the address changed
        const existing = this.devices.get(id);
        if (!existing || existing.ip !== ip) {
            this.devices.set(id, device);
            this.emit('device_found', device);
        }
    }

    private extractIPv4(service: Service): string | null {
        const addresses = service.addresses ?? [];
        const ipv4 = addresses.find((addr: string) => !addr.includes(':'));
        return ipv4 ?? (service.host || null);
    }
}

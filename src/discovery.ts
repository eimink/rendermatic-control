import { Bonjour, type Browser, type Service } from 'bonjour-service';
import { EventEmitter } from 'events';
import type { DiscoveredDevice } from './types.ts';

const REFRESH_INTERVAL = 30_000;
const SETTLE_TIME = 5_000;

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
        this.startBrowser();

        // Periodically restart the browser to detect IP changes.
        // bonjour-service silently swallows address changes when TXT
        // records haven't changed, so a simple update() isn't enough.
        this.refreshTimer = setInterval(() => this.refresh(), REFRESH_INTERVAL);
    }

    stop(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        this.stopBrowser();
        this.bonjour.destroy();
    }

    getDevices(): DiscoveredDevice[] {
        return Array.from(this.devices.values());
    }

    private startBrowser(): void {
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
    }

    private stopBrowser(): void {
        if (this.browser) {
            this.browser.stop();
            this.browser = null;
        }
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

    private refresh(): void {
        // Restart the browser to get a clean discovery pass
        this.stopBrowser();
        const seen = new Set<string>();
        const prevInstances = new Map(this.instanceToId);

        this.startBrowser();

        // Temporarily intercept 'up' to track which instances responded
        const origHandleUp = this.handleUp.bind(this);
        const trackingHandler = (service: Service) => {
            seen.add(service.name);
            origHandleUp(service);
        };
        this.browser!.removeAllListeners('up');
        this.browser!.on('up', trackingHandler);

        // After settling, prune devices that didn't respond
        setTimeout(() => {
            if (!this.browser) return;
            // Restore normal handler
            this.browser.removeAllListeners('up');
            this.browser.on('up', (service: Service) => this.handleUp(service));

            for (const [instanceName, id] of prevInstances) {
                if (!seen.has(instanceName) && this.devices.has(id)) {
                    this.devices.delete(id);
                    this.instanceToId.delete(instanceName);
                    this.emit('device_lost', id);
                }
            }
        }, SETTLE_TIME);
    }

    private extractIPv4(service: Service): string | null {
        const addresses = service.addresses ?? [];
        const ipv4 = addresses.find((addr: string) => !addr.includes(':'));
        return ipv4 ?? (service.host || null);
    }
}

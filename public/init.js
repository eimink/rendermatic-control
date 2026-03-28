document.addEventListener('DOMContentLoaded', () => {
    // Theme picker
    const themeButtons = document.querySelectorAll('.theme-picker button');
    function setTheme(name) {
        document.body.setAttribute('data-theme', name);
        localStorage.setItem('rm-theme', name);
        themeButtons.forEach(b => b.classList.toggle('active', b.dataset.themeValue === name));
    }
    themeButtons.forEach(b => b.addEventListener('click', () => setTheme(b.dataset.themeValue)));
    setTheme(document.body.getAttribute('data-theme') || 'demoscene');

    const deviceListEl = document.getElementById('deviceList');
    const noDevicesEl = document.getElementById('noDevices');
    const statusText = document.querySelector('.status-text');
    const manualAddBtn = document.getElementById('manualAddBtn');
    const manualAddress = document.getElementById('manualAddress');

    const deviceClients = new Map();
    const devicePanels = new Map();

    // Control plane connection
    const controlPlaneUrl = `ws://${window.location.host}/ws`;
    const discovery = new DiscoveryClient(controlPlaneUrl);

    discovery.setConnectionCallback((connected) => {
        document.body.classList.toggle('disconnected', !connected);
        statusText.textContent = connected ? 'Connected' : 'Disconnected';
    });

    discovery.setDeviceListCallback((devices) => {
        devices.forEach(addDevice);
        updateNoDevicesVisibility();
    });

    discovery.setDeviceFoundCallback((device) => {
        addDevice(device);
        updateNoDevicesVisibility();
    });

    discovery.setDeviceLostCallback((deviceId) => {
        removeDevice(deviceId);
        updateNoDevicesVisibility();
    });

    // Manual device add
    manualAddBtn.addEventListener('click', () => {
        const value = manualAddress.value.trim();
        if (!value) return;

        const parts = value.split(':');
        const ip = parts[0];
        const port = parseInt(parts[1] || '9002', 10);
        const id = `${ip}:${port}`;

        if (devicePanels.has(id)) return;

        const device = {
            id,
            instanceName: `Manual (${ip})`,
            hostname: ip,
            ip,
            port,
        };

        addDevice(device);
        updateNoDevicesVisibility();
        manualAddress.value = '';
    });

    manualAddress.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') manualAddBtn.click();
    });

    function updateNoDevicesVisibility() {
        noDevicesEl.classList.toggle('hidden', devicePanels.size > 0);
    }

    function addDevice(device) {
        if (devicePanels.has(device.id)) return;

        const client = new DeviceClient(device);
        deviceClients.set(device.id, client);

        const panel = createDevicePanel(device, client);
        devicePanels.set(device.id, panel);
        deviceListEl.appendChild(panel);
    }

    function removeDevice(deviceId) {
        const client = deviceClients.get(deviceId);
        if (client) {
            client.disconnect();
            deviceClients.delete(deviceId);
        }
        const panel = devicePanels.get(deviceId);
        if (panel) {
            panel.remove();
            devicePanels.delete(deviceId);
        }
    }

    function createDevicePanel(device, client) {
        const panel = document.createElement('div');
        panel.className = 'device-panel device-disconnected';

        // Header
        const header = document.createElement('div');
        header.className = 'device-panel-header';
        header.innerHTML = `
            <div>
                <div class="device-name">${esc(device.instanceName)}</div>
                <div class="device-address">${esc(device.ip)}:${device.port}</div>
            </div>
            <div class="device-connection-dot"></div>
        `;
        panel.appendChild(header);

        const body = document.createElement('div');
        body.className = 'device-panel-body';
        panel.appendChild(body);

        // Auth section (hidden initially)
        const authSection = document.createElement('div');
        authSection.className = 'auth-section';
        authSection.style.display = 'none';
        authSection.innerHTML = `
            <h3>Authentication Required</h3>
            <div class="auth-form">
                <input type="password" placeholder="Enter authentication key" class="auth-key-input">
                <button class="primary auth-submit-btn">Authenticate</button>
            </div>
            <div class="auth-message"></div>
        `;
        body.appendChild(authSection);

        const authInput = authSection.querySelector('.auth-key-input');
        const authSubmitBtn = authSection.querySelector('.auth-submit-btn');
        const authMessage = authSection.querySelector('.auth-message');

        authSubmitBtn.addEventListener('click', () => {
            const key = authInput.value.trim();
            if (key) client.authenticate(key);
        });

        authInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') authSubmitBtn.click();
        });

        // Device info section
        const infoSection = document.createElement('div');
        infoSection.className = 'section';
        infoSection.innerHTML = `
            <h3>Device Info</h3>
            <div class="device-info-grid"></div>
            <div class="name-edit">
                <input type="text" placeholder="New device name" class="name-input">
                <button class="rename-btn">Rename</button>
            </div>
            <div class="auth-key-section">
                <input type="password" placeholder="Set auth key (min 8 chars)" class="set-key-input">
                <button class="set-key-btn">Set Key</button>
                <button class="clear-key-btn danger" style="display:none">Clear Key</button>
            </div>
        `;
        body.appendChild(infoSection);

        const infoGrid = infoSection.querySelector('.device-info-grid');
        const nameInput = infoSection.querySelector('.name-input');
        const renameBtn = infoSection.querySelector('.rename-btn');
        const setKeyInput = infoSection.querySelector('.set-key-input');
        const setKeyBtn = infoSection.querySelector('.set-key-btn');
        const clearKeyBtn = infoSection.querySelector('.clear-key-btn');

        renameBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            if (name) client.setDeviceName(name);
        });

        setKeyBtn.addEventListener('click', () => {
            const key = setKeyInput.value.trim();
            if (key) client.setAuthKey(key);
        });

        clearKeyBtn.addEventListener('click', () => {
            if (confirm('Remove authentication key? Device will be open to all.')) {
                client.clearAuthKey();
            }
        });

        // Texture section
        const textureSection = document.createElement('div');
        textureSection.className = 'section';
        textureSection.innerHTML = `
            <h3>Textures</h3>
            <div class="texture-controls">
                <button class="scan-btn">Scan Textures</button>
            </div>
            <div class="texture-items"></div>
        `;
        body.appendChild(textureSection);

        const scanBtn = textureSection.querySelector('.scan-btn');
        const textureItems = textureSection.querySelector('.texture-items');

        scanBtn.addEventListener('click', () => client.scanTextures());

        // Video section
        const videoSection = document.createElement('div');
        videoSection.className = 'section';
        videoSection.innerHTML = `
            <h3>Video</h3>
            <div class="video-form">
                <input type="text" placeholder="Video source (URL or path)" class="video-source-input">
                <label><input type="checkbox" class="video-loop-check" checked> Loop</label>
                <button class="primary play-btn">Play</button>
            </div>
            <div class="video-controls">
                <button class="danger stop-btn">Stop Video</button>
                <button class="status-btn">Refresh Status</button>
            </div>
            <div class="video-status-display">No video info</div>
        `;
        body.appendChild(videoSection);

        const videoSourceInput = videoSection.querySelector('.video-source-input');
        const videoLoopCheck = videoSection.querySelector('.video-loop-check');
        const playBtn = videoSection.querySelector('.play-btn');
        const stopBtn = videoSection.querySelector('.stop-btn');
        const statusBtn = videoSection.querySelector('.status-btn');
        const videoStatusDisplay = videoSection.querySelector('.video-status-display');

        playBtn.addEventListener('click', () => {
            const source = videoSourceInput.value.trim();
            if (source) client.playVideo(source, videoLoopCheck.checked);
        });

        stopBtn.addEventListener('click', () => client.stopVideo());
        statusBtn.addEventListener('click', () => client.getVideoStatus());

        // Track current texture for highlighting
        let currentTexture = '';

        // --- Response handlers ---

        client.on('auth_status', (resp) => {
            if (resp.authRequired && !resp.authenticated) {
                authSection.style.display = '';
                setControlsEnabled(false);
            } else {
                authSection.style.display = 'none';
                setControlsEnabled(true);
                // Fetch initial data once authenticated/open
                client.getDeviceInfo();
                client.scanTextures();
            }
        });

        client.on('auth_response', (resp) => {
            if (resp.success) {
                authSection.style.display = 'none';
                authMessage.textContent = '';
                authInput.value = '';
                setControlsEnabled(true);
                client.getDeviceInfo();
                client.scanTextures();
            } else {
                authMessage.textContent = resp.message || 'Authentication failed';
                authMessage.className = 'auth-message';
                if (resp.retryAfterSeconds) {
                    authMessage.textContent += ` (retry in ${resp.retryAfterSeconds}s)`;
                }
            }
        });

        client.on('auth_required', (resp) => {
            authSection.style.display = '';
            setControlsEnabled(false);
        });

        client.on('device_info', (resp) => {
            if (!resp.success) return;
            currentTexture = resp.currentTexture || '';

            // Update header name
            header.querySelector('.device-name').textContent = resp.instanceName || device.instanceName;

            let html = '';
            if (resp.hostname) html += `<span class="label">Hostname</span><span>${esc(resp.hostname)}</span>`;
            if (resp.wsPort) html += `<span class="label">Port</span><span>${resp.wsPort}</span>`;
            if (resp.currentTexture) html += `<span class="label">Texture</span><span>${esc(resp.currentTexture)}</span>`;
            html += `<span class="label">Auth</span><span>${resp.authEnabled ? 'Enabled' : 'Disabled'}</span>`;
            infoGrid.innerHTML = html;

            // Show/hide clear key button
            clearKeyBtn.style.display = resp.authEnabled ? '' : 'none';

            // Re-render texture list to update active highlight
            refreshTextureDisplay(textureItems, client, currentTexture);
        });

        client.on('device_name_response', (resp) => {
            if (resp.success && resp.instanceName) {
                header.querySelector('.device-name').textContent = resp.instanceName;
                nameInput.value = '';
            }
        });

        client.on('set_auth_key_response', (resp) => {
            if (resp.success) {
                setKeyInput.value = '';
                clearKeyBtn.style.display = '';
            }
        });

        client.on('clear_auth_key_response', (resp) => {
            if (resp.success) {
                clearKeyBtn.style.display = 'none';
            }
        });

        client.on('scan_textures_response', (resp) => {
            if (resp.success) {
                renderTextureList(textureItems, resp.textures, client, currentTexture);
            }
        });

        client.on('texture_list', (resp) => {
            if (resp.success) {
                renderTextureList(textureItems, resp.textures, client, currentTexture);
            }
        });

        client.on('set_texture_response', (resp) => {
            if (resp.success) {
                client.getDeviceInfo();
            }
        });

        client.on('video_status', (resp) => {
            if (!resp.success) return;
            if (resp.active) {
                videoStatusDisplay.className = 'video-status-display active';
                videoStatusDisplay.innerHTML = `
                    <strong>Playing</strong>
                    <div class="video-meta">
                        <span class="label">Source</span><span>${esc(resp.source)}</span>
                        <span class="label">Resolution</span><span>${resp.width}x${resp.height}</span>
                        <span class="label">FPS</span><span>${resp.fps}</span>
                        <span class="label">Codec</span><span>${esc(resp.codec)}</span>
                        <span class="label">Duration</span><span>${resp.duration < 0 ? 'Live' : resp.duration + 's'}</span>
                    </div>
                `;
            } else {
                videoStatusDisplay.className = 'video-status-display';
                videoStatusDisplay.textContent = 'No video playing';
            }
        });

        client.on('play_video_response', (resp) => {
            if (resp.success) client.getVideoStatus();
        });

        client.on('stop_video_response', (resp) => {
            if (resp.success) {
                videoStatusDisplay.className = 'video-status-display';
                videoStatusDisplay.textContent = 'No video playing';
            }
        });

        // Connection state
        client.setConnectionCallback((connected) => {
            panel.classList.toggle('device-disconnected', !connected);
        });

        function setControlsEnabled(enabled) {
            const sections = [infoSection, textureSection, videoSection];
            sections.forEach(s => {
                s.querySelectorAll('button, input').forEach(el => {
                    el.disabled = !enabled;
                });
                s.style.opacity = enabled ? '1' : '0.4';
            });
        }

        // Store textures for re-rendering
        let lastTextures = [];

        function renderTextureList(container, textures, client, active) {
            lastTextures = textures;
            refreshTextureDisplay(container, client, active);
        }

        function refreshTextureDisplay(container, client, active) {
            container.innerHTML = '';
            lastTextures.forEach(texture => {
                const item = document.createElement('div');
                item.className = 'texture-item';

                const name = document.createElement('span');
                name.className = 'texture-name' + (texture === active ? ' active' : '');
                name.textContent = texture;
                item.appendChild(name);

                const setBtn = document.createElement('button');
                setBtn.textContent = 'Set';
                setBtn.onclick = () => client.setTexture(texture);
                item.appendChild(setBtn);

                container.appendChild(item);
            });
        }

        return panel;
    }

    function esc(str) {
        const el = document.createElement('span');
        el.textContent = str;
        return el.innerHTML;
    }
});

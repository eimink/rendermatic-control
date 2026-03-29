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

    // --- Reusable filterable file list ---

    function createFilterableList({ actions, getActiveItem }) {
        const wrapper = document.createElement('div');
        wrapper.className = 'file-list-wrapper';

        const toolbar = document.createElement('div');
        toolbar.className = 'file-list-toolbar';

        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.placeholder = 'Filter...';
        filterInput.className = 'file-list-filter';
        toolbar.appendChild(filterInput);

        const countEl = document.createElement('span');
        countEl.className = 'file-list-count';
        toolbar.appendChild(countEl);

        wrapper.appendChild(toolbar);

        const listEl = document.createElement('div');
        listEl.className = 'file-list-items';
        wrapper.appendChild(listEl);

        let allItems = [];

        function render() {
            const filter = filterInput.value.toLowerCase();
            const active = getActiveItem ? getActiveItem() : '';
            const filtered = filter
                ? allItems.filter(name => name.toLowerCase().includes(filter))
                : allItems;

            countEl.textContent = filter
                ? `${filtered.length}/${allItems.length}`
                : `${allItems.length}`;

            listEl.innerHTML = '';
            filtered.forEach(name => {
                const item = document.createElement('div');
                item.className = 'file-list-item';

                const nameEl = document.createElement('span');
                nameEl.className = 'file-list-name' + (name === active ? ' active' : '');
                nameEl.textContent = name;
                item.appendChild(nameEl);

                const btnGroup = document.createElement('div');
                btnGroup.className = 'file-list-actions';
                actions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.textContent = action.label;
                    if (action.className) btn.className = action.className;
                    btn.onclick = () => action.handler(name);
                    btnGroup.appendChild(btn);
                });
                item.appendChild(btnGroup);

                listEl.appendChild(item);
            });
        }

        filterInput.addEventListener('input', render);

        return {
            element: wrapper,
            setItems(items) {
                allItems = items;
                render();
            },
            refresh() {
                render();
            }
        };
    }

    // --- Device panel ---

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
            <div class="device-header-actions">
                <button class="identify-btn" title="Identify device on screen">Identify</button>
                <div class="device-connection-dot"></div>
            </div>
        `;
        panel.appendChild(header);

        const identifyBtn = header.querySelector('.identify-btn');
        identifyBtn.addEventListener('click', () => client.identify());

        // Auth section (above tabs, blocks everything)
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
        panel.appendChild(authSection);

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

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'tab-bar';
        const tabs = ['Device', 'Images', 'Videos', 'NDI'];
        const tabButtons = {};
        const tabPanes = {};

        tabs.forEach(name => {
            const btn = document.createElement('button');
            btn.className = 'tab-btn';
            btn.textContent = name;
            btn.addEventListener('click', () => switchTab(name));
            if (name === 'NDI') btn.style.display = 'none'; // hidden until ndiAvailable
            tabBar.appendChild(btn);
            tabButtons[name] = btn;
        });
        panel.appendChild(tabBar);

        // Tab content container
        const tabContent = document.createElement('div');
        tabContent.className = 'tab-content';
        panel.appendChild(tabContent);

        tabs.forEach(name => {
            const pane = document.createElement('div');
            pane.className = 'tab-pane';
            pane.style.display = 'none';
            tabContent.appendChild(pane);
            tabPanes[name] = pane;
        });

        let ndiAvailable = false;

        function switchTab(name) {
            tabs.forEach(t => {
                tabButtons[t].classList.toggle('active', t === name);
                tabPanes[t].style.display = t === name ? '' : 'none';
            });
        }

        switchTab('Device');

        // =====================================================================
        // Device tab
        // =====================================================================
        const devicePane = tabPanes['Device'];

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
        devicePane.appendChild(infoSection);

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

        // Rotation control
        const rotationSection = document.createElement('div');
        rotationSection.className = 'section';
        rotationSection.innerHTML = `
            <h3>Display Rotation</h3>
            <div class="rotation-controls">
                <button class="rotation-btn" data-rotation="0">0\u00b0</button>
                <button class="rotation-btn" data-rotation="90">90\u00b0</button>
                <button class="rotation-btn" data-rotation="180">180\u00b0</button>
                <button class="rotation-btn" data-rotation="270">270\u00b0</button>
            </div>
        `;
        devicePane.appendChild(rotationSection);

        rotationSection.querySelectorAll('.rotation-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                client.setRotation(parseInt(btn.dataset.rotation, 10));
            });
        });

        // =====================================================================
        // Images tab
        // =====================================================================
        const imagesPane = tabPanes['Images'];

        const textureControls = document.createElement('div');
        textureControls.className = 'tab-pane-toolbar';
        textureControls.innerHTML = '<button class="scan-textures-btn">Scan</button>';
        imagesPane.appendChild(textureControls);

        const scanTexturesBtn = textureControls.querySelector('.scan-textures-btn');
        scanTexturesBtn.addEventListener('click', () => client.scanTextures());

        let currentTexture = '';

        const textureList = createFilterableList({
            actions: [{ label: 'Set', handler: (name) => client.setTexture(name) }],
            getActiveItem: () => currentTexture,
        });
        imagesPane.appendChild(textureList.element);

        // =====================================================================
        // Videos tab
        // =====================================================================
        const videosPane = tabPanes['Videos'];

        // Video file list with scan
        const videoFileControls = document.createElement('div');
        videoFileControls.className = 'tab-pane-toolbar';
        videoFileControls.innerHTML = '<button class="scan-videos-btn">Scan</button>';
        videosPane.appendChild(videoFileControls);

        const scanVideosBtn = videoFileControls.querySelector('.scan-videos-btn');
        scanVideosBtn.addEventListener('click', () => client.scanVideos());

        const videoList = createFilterableList({
            actions: [
                { label: 'Play', handler: (name) => client.playVideo(name, videoLoopCheck.checked) },
                { label: '+', className: 'playlist-add-btn', handler: (name) => addToPlaylist(name) },
            ],
            getActiveItem: () => '',
        });
        videosPane.appendChild(videoList.element);

        // Stream input
        const streamSection = document.createElement('div');
        streamSection.className = 'section stream-section';
        streamSection.innerHTML = `
            <h3>Stream</h3>
            <div class="video-form">
                <input type="text" placeholder="Stream URL (RTMP, RTSP, SRT, HLS)" class="video-source-input">
                <label><input type="checkbox" class="video-loop-check" checked> Loop</label>
                <button class="primary play-btn">Play</button>
            </div>
        `;
        videosPane.appendChild(streamSection);

        const videoSourceInput = streamSection.querySelector('.video-source-input');
        const videoLoopCheck = streamSection.querySelector('.video-loop-check');
        const playBtn = streamSection.querySelector('.play-btn');

        playBtn.addEventListener('click', () => {
            const source = videoSourceInput.value.trim();
            if (source) client.playVideo(source, videoLoopCheck.checked);
        });

        // Playback status
        const videoStatusSection = document.createElement('div');
        videoStatusSection.className = 'section';
        videoStatusSection.innerHTML = `
            <h3>Playback</h3>
            <div class="video-controls">
                <button class="danger stop-btn">Stop</button>
                <button class="status-btn">Refresh Status</button>
            </div>
            <div class="video-status-display">No video info</div>
        `;
        videosPane.appendChild(videoStatusSection);

        const stopBtn = videoStatusSection.querySelector('.stop-btn');
        const statusBtn = videoStatusSection.querySelector('.status-btn');
        const videoStatusDisplay = videoStatusSection.querySelector('.video-status-display');

        stopBtn.addEventListener('click', () => client.stopVideo());
        statusBtn.addEventListener('click', () => client.getVideoStatus());

        // Playlist section
        const playlistSection = document.createElement('div');
        playlistSection.className = 'section playlist-section';
        playlistSection.innerHTML = `
            <h3>Playlist</h3>
            <div class="playlist-controls">
                <button class="playlist-start-btn primary">Start</button>
                <button class="playlist-stop-btn danger">Stop</button>
                <button class="playlist-prev-btn">Prev</button>
                <button class="playlist-next-btn">Next</button>
                <label><input type="checkbox" class="playlist-loop-check" checked> Loop</label>
                <button class="playlist-clear-btn">Clear</button>
            </div>
            <div class="playlist-items"></div>
            <div class="playlist-status-display"></div>
        `;
        videosPane.appendChild(playlistSection);

        const playlistStartBtn = playlistSection.querySelector('.playlist-start-btn');
        const playlistStopBtn = playlistSection.querySelector('.playlist-stop-btn');
        const playlistPrevBtn = playlistSection.querySelector('.playlist-prev-btn');
        const playlistNextBtn = playlistSection.querySelector('.playlist-next-btn');
        const playlistLoopCheck = playlistSection.querySelector('.playlist-loop-check');
        const playlistClearBtn = playlistSection.querySelector('.playlist-clear-btn');
        const playlistItemsEl = playlistSection.querySelector('.playlist-items');
        const playlistStatusDisplay = playlistSection.querySelector('.playlist-status-display');

        let playlistVideos = [];
        let playlistCurrentIndex = -1;
        let playlistActive = false;

        function addToPlaylist(name) {
            playlistVideos.push(name);
            renderPlaylist();
        }

        function removeFromPlaylist(index) {
            playlistVideos.splice(index, 1);
            renderPlaylist();
        }

        function moveInPlaylist(from, to) {
            if (to < 0 || to >= playlistVideos.length) return;
            const item = playlistVideos.splice(from, 1)[0];
            playlistVideos.splice(to, 0, item);
            renderPlaylist();
        }

        function renderPlaylist() {
            playlistItemsEl.innerHTML = '';
            if (playlistVideos.length === 0) {
                playlistItemsEl.innerHTML = '<div class="playlist-empty">Add videos with the + button above</div>';
                return;
            }
            playlistVideos.forEach((name, i) => {
                const item = document.createElement('div');
                item.className = 'playlist-item' + (playlistActive && i === playlistCurrentIndex ? ' playing' : '');

                const indexEl = document.createElement('span');
                indexEl.className = 'playlist-index';
                indexEl.textContent = `${i + 1}.`;
                item.appendChild(indexEl);

                const nameEl = document.createElement('span');
                nameEl.className = 'playlist-item-name';
                nameEl.textContent = name;
                item.appendChild(nameEl);

                const actions = document.createElement('div');
                actions.className = 'playlist-item-actions';

                const upBtn = document.createElement('button');
                upBtn.textContent = '\u2191';
                upBtn.disabled = i === 0;
                upBtn.onclick = () => moveInPlaylist(i, i - 1);
                actions.appendChild(upBtn);

                const downBtn = document.createElement('button');
                downBtn.textContent = '\u2193';
                downBtn.disabled = i === playlistVideos.length - 1;
                downBtn.onclick = () => moveInPlaylist(i, i + 1);
                actions.appendChild(downBtn);

                const removeBtn = document.createElement('button');
                removeBtn.textContent = '\u00d7';
                removeBtn.className = 'danger';
                removeBtn.onclick = () => removeFromPlaylist(i);
                actions.appendChild(removeBtn);

                item.appendChild(actions);
                playlistItemsEl.appendChild(item);
            });
        }

        playlistStartBtn.addEventListener('click', () => {
            if (playlistVideos.length === 0) return;
            client.setPlaylist(playlistVideos, playlistLoopCheck.checked);
            // Start will be triggered after set_playlist_response
        });

        playlistStopBtn.addEventListener('click', () => client.stopPlaylist());
        playlistPrevBtn.addEventListener('click', () => client.prevVideo());
        playlistNextBtn.addEventListener('click', () => client.nextVideo());

        playlistClearBtn.addEventListener('click', () => {
            playlistVideos = [];
            renderPlaylist();
        });

        renderPlaylist();

        // =====================================================================
        // NDI tab
        // =====================================================================
        const ndiPane = tabPanes['NDI'];

        const ndiControls = document.createElement('div');
        ndiControls.className = 'tab-pane-toolbar';
        ndiControls.innerHTML = '<button class="scan-ndi-btn">Scan Sources</button>';
        ndiPane.appendChild(ndiControls);

        const scanNdiBtn = ndiControls.querySelector('.scan-ndi-btn');
        scanNdiBtn.addEventListener('click', () => client.scanNdiSources());

        let activeNdiSource = '';

        const ndiSourceList = createFilterableList({
            actions: [{ label: 'Connect', handler: (name) => client.setNdiSource(name) }],
            getActiveItem: () => activeNdiSource,
        });
        ndiPane.appendChild(ndiSourceList.element);

        const ndiStatusSection = document.createElement('div');
        ndiStatusSection.className = 'section';
        ndiStatusSection.innerHTML = `
            <h3>NDI Status</h3>
            <div class="ndi-controls">
                <button class="danger ndi-stop-btn">Disconnect</button>
                <button class="ndi-refresh-btn">Refresh Status</button>
            </div>
            <div class="ndi-status-display">No NDI source connected</div>
        `;
        ndiPane.appendChild(ndiStatusSection);

        const ndiStopBtn = ndiStatusSection.querySelector('.ndi-stop-btn');
        const ndiRefreshBtn = ndiStatusSection.querySelector('.ndi-refresh-btn');
        const ndiStatusDisplay = ndiStatusSection.querySelector('.ndi-status-display');

        ndiStopBtn.addEventListener('click', () => client.stopNdi());
        ndiRefreshBtn.addEventListener('click', () => client.getNdiStatus());

        // =====================================================================
        // Response handlers
        // =====================================================================

        client.on('auth_status', (resp) => {
            if (resp.authRequired && !resp.authenticated) {
                authSection.style.display = '';
                tabBar.style.display = 'none';
                tabContent.style.display = 'none';
                setControlsEnabled(false);
            } else {
                authSection.style.display = 'none';
                tabBar.style.display = '';
                tabContent.style.display = '';
                setControlsEnabled(true);
                client.getDeviceInfo();
                client.scanTextures();
                client.scanVideos();
                client.getPlaylistStatus();
            }
        });

        client.on('auth_response', (resp) => {
            if (resp.success) {
                authSection.style.display = 'none';
                authMessage.textContent = '';
                authInput.value = '';
                tabBar.style.display = '';
                tabContent.style.display = '';
                setControlsEnabled(true);
                client.getDeviceInfo();
                client.scanTextures();
                client.scanVideos();
                client.getPlaylistStatus();
            } else {
                authMessage.textContent = resp.message || 'Authentication failed';
                authMessage.className = 'auth-message';
                if (resp.retryAfterSeconds) {
                    authMessage.textContent += ` (retry in ${resp.retryAfterSeconds}s)`;
                }
            }
        });

        client.on('auth_required', () => {
            authSection.style.display = '';
            tabBar.style.display = 'none';
            tabContent.style.display = 'none';
            setControlsEnabled(false);
        });

        client.on('device_info', (resp) => {
            if (!resp.success) return;
            currentTexture = resp.currentTexture || '';

            header.querySelector('.device-name').textContent = resp.instanceName || device.instanceName;

            let html = '';
            if (resp.hostname) html += `<span class="label">Hostname</span><span>${esc(resp.hostname)}</span>`;
            if (resp.wsPort) html += `<span class="label">Port</span><span>${resp.wsPort}</span>`;
            if (resp.currentTexture) html += `<span class="label">Texture</span><span>${esc(resp.currentTexture)}</span>`;
            html += `<span class="label">Auth</span><span>${resp.authEnabled ? 'Enabled' : 'Disabled'}</span>`;
            html += `<span class="label">NDI</span><span>${resp.ndiAvailable ? 'Available' : 'Not available'}</span>`;
            infoGrid.innerHTML = html;

            clearKeyBtn.style.display = resp.authEnabled ? '' : 'none';

            // Show/hide NDI tab based on device capability
            if (resp.ndiAvailable && !ndiAvailable) {
                ndiAvailable = true;
                tabButtons['NDI'].style.display = '';
                client.getNdiStatus();
            } else if (!resp.ndiAvailable) {
                ndiAvailable = false;
                tabButtons['NDI'].style.display = 'none';
            }

            textureList.refresh();
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
            if (resp.success) textureList.setItems(resp.textures);
        });

        client.on('texture_list', (resp) => {
            if (resp.success) textureList.setItems(resp.textures);
        });

        client.on('set_texture_response', (resp) => {
            if (resp.success) client.getDeviceInfo();
        });

        client.on('scan_videos_response', (resp) => {
            if (resp.success) videoList.setItems(resp.videos);
        });

        client.on('video_list', (resp) => {
            if (resp.success) videoList.setItems(resp.videos);
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

        // Playlist responses
        client.on('set_playlist_response', (resp) => {
            if (resp.success) {
                client.startPlaylist();
            }
        });

        client.on('start_playlist_response', (resp) => {
            if (resp.success) client.getPlaylistStatus();
        });

        client.on('stop_playlist_response', (resp) => {
            if (resp.success) {
                playlistActive = false;
                playlistCurrentIndex = -1;
                renderPlaylist();
                playlistStatusDisplay.textContent = 'Stopped';
            }
        });

        client.on('next_video_response', (resp) => {
            if (resp.success) {
                playlistCurrentIndex = resp.currentIndex;
                renderPlaylist();
                client.getVideoStatus();
            }
        });

        client.on('prev_video_response', (resp) => {
            if (resp.success) {
                playlistCurrentIndex = resp.currentIndex;
                renderPlaylist();
                client.getVideoStatus();
            }
        });

        client.on('playlist_status', (resp) => {
            if (!resp.success) return;
            playlistActive = resp.active;
            playlistCurrentIndex = resp.currentIndex;
            playlistLoopCheck.checked = resp.loop;

            // Sync playlist from device if we have no local edits
            if (resp.videos && resp.videos.length > 0 && playlistVideos.length === 0) {
                playlistVideos = [...resp.videos];
            }

            renderPlaylist();

            if (resp.active) {
                playlistStatusDisplay.innerHTML =
                    `Playing <strong>${esc(resp.currentSource)}</strong> (${resp.currentIndex + 1}/${resp.videos.length})`;
            } else {
                playlistStatusDisplay.textContent = resp.videos.length > 0 ? 'Stopped' : '';
            }
        });

        client.on('identify_response', () => {});

        // NDI responses
        client.on('ndi_sources', (resp) => {
            if (resp.success) ndiSourceList.setItems(resp.sources);
        });

        client.on('set_ndi_source_response', (resp) => {
            if (resp.success) client.getNdiStatus();
        });

        client.on('ndi_status', (resp) => {
            if (!resp.success) return;
            if (resp.active) {
                activeNdiSource = resp.source;
                ndiStatusDisplay.className = 'ndi-status-display active';
                ndiStatusDisplay.innerHTML = `
                    <strong>Connected</strong>
                    <div class="video-meta">
                        <span class="label">Source</span><span>${esc(resp.source)}</span>
                        <span class="label">Resolution</span><span>${resp.width}x${resp.height}</span>
                        <span class="label">FPS</span><span>${resp.fps}</span>
                    </div>
                `;
            } else {
                activeNdiSource = '';
                ndiStatusDisplay.className = 'ndi-status-display';
                ndiStatusDisplay.textContent = 'No NDI source connected';
            }
            ndiSourceList.refresh();
        });

        client.on('stop_ndi_response', (resp) => {
            if (resp.success) {
                activeNdiSource = '';
                ndiStatusDisplay.className = 'ndi-status-display';
                ndiStatusDisplay.textContent = 'No NDI source connected';
                ndiSourceList.refresh();
            }
        });

        // Rotation response
        client.on('set_rotation_response', (resp) => {
            if (resp.success) client.getDeviceInfo();
        });

        // Connection state
        client.setConnectionCallback((connected) => {
            panel.classList.toggle('device-disconnected', !connected);
        });

        function setControlsEnabled(enabled) {
            const allSections = panel.querySelectorAll('.section, .tab-pane-toolbar, .file-list-wrapper, .stream-section, .playlist-section');
            allSections.forEach(s => {
                s.querySelectorAll('button, input').forEach(el => {
                    el.disabled = !enabled;
                });
                s.style.opacity = enabled ? '1' : '0.4';
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

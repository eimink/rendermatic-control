# Rendermatic Control

A web-based control panel for managing [Rendermatic](https://github.com/eimink/rendermatic) display devices on the local network. Discovers devices automatically via mDNS and provides a multi-device dashboard for textures, video playback, and device configuration.

## Features

- Automatic device discovery via mDNS (`_rendermatic._tcp`)
- Multi-device dashboard with per-device controls
- Texture management (scan, set)
- Video playback (local files, RTMP, RTSP, SRT, HLS streams)
- Device authentication support
- Device renaming
- Manual device add for networks without mDNS
- Three switchable dark themes

## Requirements

- Node.js 24+

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
npm start
```

Open `http://localhost:3000` in a browser. Devices on the network will appear automatically.

## Docker

Pull the latest release from GHCR:

```bash
docker run --network host ghcr.io/eimink/rendermatic-control:latest
```

Or use Docker Compose:

```yaml
services:
  rendermatic-control:
    image: ghcr.io/eimink/rendermatic-control:latest
    network_mode: host
    restart: unless-stopped
```

To build locally instead:

```bash
docker build -t rendermatic-control .
docker run --network host rendermatic-control
```

Host networking is required for mDNS device discovery. Without it, multicast traffic won't reach the container and automatic discovery won't work. Manual device add (`IP:Port`) still works in bridged mode.

## Development

```bash
npm run build-dev    # webpack dev build with source maps
npm start            # start the server
```

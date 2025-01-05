# Rendermatic Control

A WebSocket client for sending control commands to a rendermatic server.

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

The client will connect to a WebSocket server and can send control commands.

## Available Commands

- `list_textures`: Get a list of available textures
- `load_texture`: Load a texture file (requires texture parameter)
- `set_texture`: Set the current texture (requires texture parameter)

### Example Usage
```typescript
client.sendCommand({ command: 'list_textures' });
client.sendCommand({ command: 'load_texture', texture: 'image.png' });
client.sendCommand({ command: 'set_texture', texture: 'image.png' });
```


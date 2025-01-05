/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
__webpack_unused_export__ = void 0;
class ControlClient {
    constructor(serverUrl) {
        this.serverUrl = serverUrl;
        this.textureList = [];
        this.onTexturesUpdated = null;
        this.ws = new WebSocket(serverUrl);
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.ws.onopen = () => {
            console.log('Connected to server');
            document.body.classList.remove('disconnected');
        };
        this.ws.onmessage = (event) => {
            const response = JSON.parse(event.data);
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
    sendCommand(command) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(command));
        }
        else {
            console.error('WebSocket is not connected');
        }
    }
    setTexturesCallback(callback) {
        this.onTexturesUpdated = callback;
    }
    refreshTextures() {
        this.sendCommand({ command: 'scan_textures' });
    }
    loadTexture(texture) {
        this.sendCommand({ command: 'load_texture', texture });
    }
    setTexture(texture) {
        this.sendCommand({ command: 'set_texture', texture });
    }
}
__webpack_unused_export__ = ControlClient;
// Make ControlClient available globally
window.ControlClient = ControlClient;

})();

/******/ })()
;
//# sourceMappingURL=client.js.map
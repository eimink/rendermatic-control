// --- Command types ---

export type AuthenticateCommand = {
    command: 'authenticate';
    key: string;
};

export type SetAuthKeyCommand = {
    command: 'set_auth_key';
    key: string;
};

export type ClearAuthKeyCommand = {
    command: 'clear_auth_key';
};

export type GetAuthStatusCommand = {
    command: 'get_auth_status';
};

export type GetDeviceInfoCommand = {
    command: 'get_device_info';
};

export type SetDeviceNameCommand = {
    command: 'set_device_name';
    name: string;
};

export type ScanTexturesCommand = {
    command: 'scan_textures';
};

export type ListTexturesCommand = {
    command: 'list_textures';
};

export type LoadTextureCommand = {
    command: 'load_texture';
    texture: string;
};

export type SetTextureCommand = {
    command: 'set_texture';
    texture: string;
};

export type PlayVideoCommand = {
    command: 'play_video';
    source: string;
    loop?: boolean;
};

export type StopVideoCommand = {
    command: 'stop_video';
};

export type GetVideoStatusCommand = {
    command: 'get_video_status';
};

export type ControlCommand =
    | AuthenticateCommand
    | SetAuthKeyCommand
    | ClearAuthKeyCommand
    | GetAuthStatusCommand
    | GetDeviceInfoCommand
    | SetDeviceNameCommand
    | ScanTexturesCommand
    | ListTexturesCommand
    | LoadTextureCommand
    | SetTextureCommand
    | PlayVideoCommand
    | StopVideoCommand
    | GetVideoStatusCommand;

// --- Response types ---

export type BaseResponse = {
    command: string;
    success: boolean;
    message?: string;
};

// Server-initiated on connect + response to get_auth_status
export type AuthStatusResponse = BaseResponse & {
    command: 'auth_status';
    authRequired?: boolean;
    authEnabled?: boolean;
    authenticated: boolean;
};

export type AuthResponse = BaseResponse & {
    command: 'auth_response';
    retryAfterSeconds?: number;
};

export type SetAuthKeyResponse = BaseResponse & {
    command: 'set_auth_key_response';
};

export type ClearAuthKeyResponse = BaseResponse & {
    command: 'clear_auth_key_response';
};

// Full device info (authenticated or open mode)
export type DeviceInfoResponse = BaseResponse & {
    command: 'device_info';
    instanceName: string;
    hostname?: string;
    wsPort?: number;
    currentTexture?: string;
    authEnabled?: boolean;
    authRequired?: boolean;
    authenticated?: boolean;
};

export type DeviceNameResponse = BaseResponse & {
    command: 'device_name_response';
    instanceName?: string;
};

export type ScanTexturesResponse = BaseResponse & {
    command: 'scan_textures_response';
    textures: string[];
};

export type TextureListResponse = BaseResponse & {
    command: 'texture_list';
    textures: string[];
};

export type LoadTextureResponse = BaseResponse & {
    command: 'load_texture_response';
};

export type SetTextureResponse = BaseResponse & {
    command: 'set_texture_response';
};

export type PlayVideoResponse = BaseResponse & {
    command: 'play_video_response';
};

export type StopVideoResponse = BaseResponse & {
    command: 'stop_video_response';
};

export type VideoStatusResponse = BaseResponse & {
    command: 'video_status';
    active: boolean;
    source: string;
    width: number;
    height: number;
    fps: number;
    duration: number;
    codec: string;
};

export type AuthRequiredResponse = BaseResponse & {
    command: 'auth_required';
};

export type ErrorResponse = BaseResponse & {
    command: 'error';
};

export type ServerResponse =
    | AuthStatusResponse
    | AuthResponse
    | SetAuthKeyResponse
    | ClearAuthKeyResponse
    | DeviceInfoResponse
    | DeviceNameResponse
    | ScanTexturesResponse
    | TextureListResponse
    | LoadTextureResponse
    | SetTextureResponse
    | PlayVideoResponse
    | StopVideoResponse
    | VideoStatusResponse
    | AuthRequiredResponse
    | ErrorResponse;

// --- Discovery types (control plane between server and browser) ---

export type DiscoveredDevice = {
    id: string;
    instanceName: string;
    hostname: string;
    ip: string;
    port: number;
};

export type ControlPlaneMessage =
    | { type: 'device_found'; device: DiscoveredDevice }
    | { type: 'device_lost'; deviceId: string }
    | { type: 'device_list'; devices: DiscoveredDevice[] };

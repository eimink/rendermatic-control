export type ControlCommand = {
    command: 'scan_textures' | 'list_textures' | 'load_texture' | 'set_texture';
    texture?: string;
};

export type ServerResponse = {
    success: 'success' | 'error';
    command: string;
    textures?: string[];
};

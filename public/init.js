document.addEventListener('DOMContentLoaded', () => {
    const client = new ControlClient('ws://192.168.64.2:9002');
    const textureList = document.getElementById('textureList');
    const refreshButton = document.getElementById('refreshButton');

    // Setup refresh button handler
    refreshButton.addEventListener('click', () => {
        client.refreshTextures();
    });

    // Setup texture list updates handler
    client.setTexturesCallback((textures) => {
        textureList.innerHTML = '';
        textures.forEach(texture => {
            const div = document.createElement('div');
            div.className = 'texture-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = texture;
            div.appendChild(nameSpan);

            const loadButton = document.createElement('button');
            loadButton.textContent = 'Load';
            loadButton.onclick = () => client.loadTexture(texture);
            div.appendChild(loadButton);

            const setButton = document.createElement('button');
            setButton.textContent = 'Set';
            setButton.onclick = () => client.setTexture(texture);
            div.appendChild(setButton);

            textureList.appendChild(div);
        });
    });

    // Initial texture list load
    client.refreshTextures();
});

const path = require('path');

module.exports = {
    entry: './src/browser-client.ts',
    output: {
        filename: 'client.js',
        path: path.resolve(__dirname, 'public'),
    },
    mode: 'development',
    devtool: 'source-map',
    optimization: {
        minimize: false
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    }
};

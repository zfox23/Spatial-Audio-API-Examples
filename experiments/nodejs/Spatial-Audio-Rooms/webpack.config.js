const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: {
        index: ['webpack-hot-middleware/client', './src/client/ts/index.ts']
    },
    devtool: 'inline-source-map',
    devServer: {
        contentBase: './dist',
    },
    mode: 'development',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
        clean: true,
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: `Webpack Example - High Fidelity's Spatial Audio API`,
            template: `./src/client/html/index.html`,
            filename: `./index.html`,
            excludeChunks: ['src/server/*'],
        }),
        new webpack.HotModuleReplacementPlugin(),
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    target: 'node',
    node: {
        global: false,
        __filename: false,
        __dirname: false,
    },
};
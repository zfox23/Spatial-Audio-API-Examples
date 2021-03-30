const path = require('path');
const webpack = require('webpack');
const devMode = process.env.NODE_ENV !== 'production'
// const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    entry: {
        index: ['webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000&reload=true', './src/client/ts/index.ts']
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
            {
                test: /\.s[ac]ss$/i,
                use: [
                    "style-loader",
                    {
                        "loader": "css-loader",
                        "options": {
                            modules: {
                                localIdentName: '[path][name]-[local]'
                            },
                            importLoaders: 1,
                        }
                    },
                    "sass-loader",
                ],
            },
        ],
    },
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist'),
        publicPath: '/',
        clean: true,
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
};
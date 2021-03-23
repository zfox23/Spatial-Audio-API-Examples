const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const auth = require('./auth.json');
const webpack = require('webpack');
const jsonwebtoken = require('jsonwebtoken');

// We generate our JWT here so we can pass it to the HTML using the `DefinePlugin` below.
function generateHiFiJWT() {
    try {
        let jwtArgs = {
            "app_id": auth.HIFI_APP_ID,
            "space_name": auth.HIFI_DEFAULT_SPACE_NAME
        };

        return jsonwebtoken.sign(jwtArgs, auth.HIFI_APP_SECRET);
    } catch (error) {
        console.error(`Couldn't create JWT! Error:${error}`);
        return;
    }
}

module.exports = {
    entry: {
        index: './src/index.ts',
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
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: `Webpack Example - High Fidelity's Spatial Audio API`,
        }),
        new webpack.DefinePlugin({
            HIFI_JWT: JSON.stringify(generateHiFiJWT())
        }),
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
};
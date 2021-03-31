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
                    {
                        "loader": "style-loader"
                    },
                    {
                        "loader": "css-loader",
                        "options": {
                            importLoaders: 1,
                        }
                    },
                    {
                        "loader": "sass-loader",
                        options: {
                            // Prefer Dart Sass
                            implementation: require('sass'),
                        },
                    }
                ],
            },
            {
                test: /\.(png|svg|jpg|gif|woff|woff2|eot|ttf|otf|ico|mp3|wav)$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: {
                            name: '[name].[ext]',
                        },
                    },
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
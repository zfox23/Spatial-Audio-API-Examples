const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = (env) => {
    const isInProdMode = (env && env.prod === true);

    console.log(`*****\nWebpack production mode status: ${isInProdMode}\n*****\n`);

    return {
        entry: {
            index: isInProdMode ? './src/client/ts/index.ts' : ['webpack-hot-middleware/client?path=/__webpack_hmr&timeout=20000&reload=true', './src/client/ts/index.ts']
        },
        devtool: isInProdMode ? undefined : 'inline-source-map',
        mode: isInProdMode ? 'production' : 'development',
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
                            "loader": isInProdMode ? MiniCssExtractPlugin.loader : "style-loader"
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
            publicPath: '/spatial-audio-rooms/',
            clean: true,
        },
        plugins: isInProdMode ? [new MiniCssExtractPlugin({
            filename: '[name].css',
            chunkFilename: '[id].css',
        })] : [new webpack.HotModuleReplacementPlugin()],
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
        },
    }
};
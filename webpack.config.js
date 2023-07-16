const CopyPlugin = require("copy-webpack-plugin");
const NpmDtsPlugin = require('npm-dts-webpack-plugin')

module.exports = (env, argv) => ({
  mode: 'production',
  entry: {
    snExtApi: 'index.ts'
  },
  output: {
    filename: "[name].js",
    clean: true,
    libraryExport: 'default',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.css$/i,
        use: [
          "style-loader",
          "css-loader"
        ],
      }
    ]
  },
  resolve: {
    modules: [
      'node_modules',
      'src'
    ],
    extensions: ['.ts', '.js']
  },
  optimization: {
    minimize: true
  },
  plugins: [
    new NpmDtsPlugin({
      output: 'dist/snExtApi.d.ts'
    }),
    new CopyPlugin({
      patterns: [
        {
          from: 'src/sn.min.css'
        }
      ]
    })
  ],
});

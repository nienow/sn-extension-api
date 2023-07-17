const CopyPlugin = require("copy-webpack-plugin");

module.exports = (env, argv) => ({
  mode: 'production',
  entry: {
    index: 'index.ts'
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
        test: /\.(ts)$/,
        exclude: /node_modules/,
        use: ["ts-loader"]
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
    new CopyPlugin({
      patterns: [
        {
          from: 'src/sn.min.css'
        }
      ]
    })
  ],
});

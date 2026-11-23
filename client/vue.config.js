const path = require('path');

module.exports = {
  chainWebpack: config => {
    config.resolve.alias.set(
      'vue$',
      // If using the runtime only build
      path.resolve(__dirname, 'node_modules/vue/dist/vue.runtime.esm.js')
      // Or if using full build of Vue (runtime + compiler)
      // path.resolve(__dirname, 'node_modules/vue/dist/vue.esm.js')
    )
  },
  devServer: {
    port: 8080,
    client: {
      overlay: {
        warnings: false,
        // "ResizeObserver loop ..." is a harmless browser notice, not a real error:
        // don't cover the whole page with it during development.
        runtimeErrors: (error) => !/ResizeObserver loop/.test(error && error.message ? error.message : ""),
      },
    },
  },
}

// @ts-check
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Il tarball npm di expo-sqlite non include wa-sqlite.wasm; lo vendiamo e lo mappiamo qui.
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}

const origResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const origin = (context.originModulePath ?? '').replace(/\\/g, '/');
  if (
    moduleName === './wa-sqlite/wa-sqlite.wasm' &&
    origin.includes('expo-sqlite') &&
    origin.includes('/web/worker')
  ) {
    return {
      type: 'assetFiles',
      filePaths: [path.resolve(__dirname, 'vendor', 'expo-sqlite-wa-sqlite.wasm')],
    };
  }
  // tslib annidato in pdf-lib: default export mancante → "Cannot destructure __extends of tslib.default"
  if (
    (moduleName === '../tslib.js' || moduleName === '..\\tslib.js') &&
    origin.includes('/pdf-lib/node_modules/tslib/modules/')
  ) {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'shims', 'pdf-lib-tslib-bridge.js'),
    };
  }
  if (typeof origResolveRequest === 'function') {
    return origResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

// metro.config.js - TAMAMEN DOĞRU
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ✅ Crypto polyfill - react-native-get-random-values
config.resolver.extraNodeModules = {
    crypto: require.resolve('react-native-get-random-values'),
    // Solana web3.js için gerekli diğer polyfills
    stream: require.resolve('readable-stream'),
    buffer: require.resolve('buffer'),
};

module.exports = config;
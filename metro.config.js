const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
    crypto: require.resolve('react-native-get-random-values'),
    // Solana web3.js için gerekli diğer polyfills
    stream: require.resolve('readable-stream'),
    buffer: require.resolve('buffer'),
};

module.exports = config;

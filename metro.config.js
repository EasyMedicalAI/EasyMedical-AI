const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude VirtualView from codegen
const { resolver } = config;
const originalResolveRequest = resolver.resolveRequest;

resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.includes('VirtualViewNativeComponent')) {
    return {
      filePath: moduleName,
      type: 'empty',
    };
  }
  return originalResolveRequest(context, moduleName, platform);
};

module.exports = config;

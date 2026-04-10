const { withProjectBuildGradle, withAppBuildGradle } = require('expo/config-plugins');

module.exports = function withFFMPEGKit(config) {
  // Modify project build.gradle - Add repository and dependency
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === 'groovy') {
      // Add jitpack repository
      config.modResults.contents = config.modResults.contents.replace(
        /allprojects \{/,
        `allprojects {
        repositories {
            maven { url 'https://jitpack.io' }
        }`
      );
      
      // Add dependency in correct format
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies \{/,
        `dependencies {
        implementation 'com.arthenica:mobile-ffmpeg-full:4.4.LTS'`
      );
    }
    return config;
  });
  
  return config;
};
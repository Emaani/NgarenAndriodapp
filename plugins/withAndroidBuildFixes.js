const { withAppBuildGradle, withGradleProperties } = require('@expo/config-plugins');

/**
 * Durable Android build fixes for the Ngaren app.
 *
 * `android/` is gitignored and regenerated from app.json by `expo prebuild`, so
 * these native build settings must live in the config layer to survive prebuild
 * and CI. This plugin reapplies them on every prebuild:
 *
 *  1. Disable release lint. The `lintVitalAnalyzeRelease` worker crashes on this
 *     AGP + Kotlin combination (NoClassDefFound
 *     org/jetbrains/kotlin/config/LanguageVersionSettings). Lint is a
 *     static-analysis gate, not part of assembling the APK, so we skip it for
 *     release builds to unblock the distributable artifact.
 *
 *  2. Pin the shipped ABIs to arm64-v8a (every real Android 7–17 device) and
 *     x86_64 (emulators / Chromebooks). This cuts native build time versus the
 *     all-four-ABI default and shrinks the CMake output surface.
 */

function addLintDisable(contents) {
  if (contents.includes('checkReleaseBuilds false')) return contents;
  return contents.replace(
    /android\s*\{/,
    `android {
    // Skip release lint: lintVitalAnalyzeRelease crashes on this AGP+Kotlin
    // combo (NoClassDefFound LanguageVersionSettings). Lint is static analysis,
    // not part of producing the APK. Injected by plugins/withAndroidBuildFixes.js.
    lint {
        checkReleaseBuilds false
        abortOnError false
    }`,
  );
}

const withAndroidBuildFixes = (config) => {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language === 'groovy') {
      cfg.modResults.contents = addLintDisable(cfg.modResults.contents);
    }
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    const setProperty = (key, value) => {
      const existing = cfg.modResults.find(
        (item) => item.type === 'property' && item.key === key,
      );
      if (existing) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: 'property', key, value });
      }
    };
    setProperty('reactNativeArchitectures', 'arm64-v8a,x86_64');
    return cfg;
  });

  return config;
};

module.exports = withAndroidBuildFixes;

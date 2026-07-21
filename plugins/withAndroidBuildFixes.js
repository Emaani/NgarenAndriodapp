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
 *  2. Ship armeabi-v7a (32-bit ARM: budget/older phones and tablets),
 *     arm64-v8a (every modern device) and x86_64 (emulators / Chromebooks).
 *     armeabi-v7a is required for universal installability — a 64-bit-only APK
 *     simply cannot be installed on a 32-bit ARM device, which surfaces to
 *     testers as an unexplained "app not installed". Only 32-bit x86 is
 *     omitted, since those emulator images are long obsolete.
 *
 *  3. Raise the Gradle daemon's heap from Expo's 2048m default to 4096m. Seen
 *     locally as "Unable to connect to the child process 'Gradle Worker
 *     Daemon'" under memory pressure on this many native modules (reanimated,
 *     worklets, screens, svg, gesture-handler, expo-ui, ...) compiled for two
 *     ABIs at once; the same class of failure is the leading suspect for the
 *     generic EAS_BUILD_UNKNOWN_GRADLE_ERROR seen on EAS's own build workers.
 *
 *  4. Use legacy JNI packaging (extractNativeLibs=true). The modern default
 *     (extractNativeLibs=false) stores .so files uncompressed and memory-maps
 *     them straight out of the APK. That works on new Android but is a
 *     well-known cause of "keeps stopping" startup crashes on older devices
 *     (Android 8-era, notably Samsung/Exynos) that can't reliably dlopen an
 *     uncompressed library directly from the APK. Extracting the libraries to
 *     the app's private lib dir at install time is the universally-compatible
 *     behaviour, at the cost of a slightly larger on-disk footprint.
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
    setProperty('reactNativeArchitectures', 'armeabi-v7a,arm64-v8a,x86_64');
    setProperty('org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=1024m');
    // Extract native libs at install time (see #4 above) for old-device compat.
    setProperty('expo.useLegacyPackaging', 'true');
    return cfg;
  });

  return config;
};

module.exports = withAndroidBuildFixes;

// app.json holds the app's settings. This file adds two things that depend on where the
// build runs:
//   1. the Firebase file for Android push when it is present, so builds still work before
//      Firebase is set up;
//   2. the Android release-build settings (expo-build-properties), which eas.json steers
//      per profile through two environment variables.
const fs = require("fs");
const path = require("path");

module.exports = ({ config }) => {
  const local = path.join(__dirname, "google-services.json");
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? "./google-services.json" : undefined);

  // HN_ANDROID_ARCHS: which phone processors to build for, e.g. "arm64-v8a,armeabi-v7a".
  // Unset means all four (the two x86 ones are only for emulators).
  const archs = (process.env.HN_ANDROID_ARCHS || "").split(",").map((s) => s.trim()).filter(Boolean);

  const android = {
    // R8 removes unused Java/Kotlin code, and unused resources go with it. Release builds only.
    enableMinifyInReleaseBuilds: true,
    enableShrinkResourcesInReleaseBuilds: true,
    ...(archs.length ? { buildArchs: archs } : {}),
    // HN_COMPRESS_NATIVE_LIBS=1: store the native libraries compressed inside the APK. The
    // file to download is much smaller; Android unpacks the libraries when it installs.
    // Used for the test APK only: the Play Store compresses downloads by itself.
    ...(process.env.HN_COMPRESS_NATIVE_LIBS === "1" ? { useLegacyPackaging: true } : {}),
  };

  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
    plugins: [...(config.plugins ?? []), ["expo-build-properties", { android }]],
  };
};

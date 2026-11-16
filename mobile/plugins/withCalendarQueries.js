// Android 11+ hides other apps unless the manifest says which ones this app needs to find.
// "Add to calendar" opens the phone's calendar app with an "insert event" request, so that
// request is declared here; without it the phone answers "no app can do this" even when a
// calendar app is installed.
const { withAndroidManifest } = require("expo/config-plugins");

const ACTION = "android.intent.action.INSERT";
const MIME = "vnd.android.cursor.dir/event";

module.exports = function withCalendarQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [];
    const has = manifest.queries.some((q) => (q.intent ?? []).some((i) =>
      (i.action ?? []).some((a) => a.$?.["android:name"] === ACTION) && (i.data ?? []).some((d) => d.$?.["android:mimeType"] === MIME)));
    if (!has) {
      manifest.queries.push({ intent: [{ action: [{ $: { "android:name": ACTION } }], data: [{ $: { "android:mimeType": MIME } }] }] });
    }
    return cfg;
  });
};

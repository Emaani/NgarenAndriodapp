// Extends app.json. Push notifications on Android need Firebase: once the
// project's google-services.json is placed next to this file (and committed,
// so EAS builds include it), the build picks it up. Without it the app still
// builds; it just can't get a push token. See docs/PUSH_AND_MESSAGES.md.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServicesFile = './google-services.json';
  if (fs.existsSync(path.join(__dirname, googleServicesFile))) {
    config.android = { ...config.android, googleServicesFile };
  }
  return config;
};

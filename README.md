# Classroom → WhatsApp

Userscript for Google Classroom, WhatsApp Web, and Mriia.

## Install on each device

1. Install Tampermonkey in Chrome.
2. Open the [userscript install URL](https://raw.githubusercontent.com/shatVM/Classroom---WhatsApp/main/script.js).
3. Confirm **Install** in Tampermonkey.

The script is installed separately on each device. Tampermonkey checks the stable
GitHub URL for updates; it does not require the local Node.js server.

## Publish an update

Edit `script.js`, increment both the `@version` metadata and `SCRIPT_VERSION`,
then commit and push the change to the `main` branch. Tampermonkey will pick up
the new version on its next update check. Users can also trigger an update from
the Tampermonkey dashboard.

This repository is public, so the userscript source is publicly visible.

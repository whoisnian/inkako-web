# project history

## coding with agent
* Claude Code with `Claude Opus 4.7`
* Copilot Chat Agent with `Claude Sonnet 4.6`

### 2026-05-07-init-project
https://github.com/whoisnian/misc/tree/master/cmd/inkako/python
```md
Based on the existing `../misc/cmd/inkako/python/PROTOCOL.md` and `../misc/cmd/inkako/python/inkako.py`, translate the python script into a JavaScript application using the Web Bluetooth API.
The application should be built using latest react@19.2.6 and esbuild@0.28.0 and run in the Chrome browser, for both desktop and mobile platforms.
Users can scan for and connect to Bluetooth device, then select and adjust image file locally, preview the image, and send it to the connected Bluetooth device.
```

### 2026-05-08-application-theme
```md
Supports auto/dark/light theme switching. Use auto theme by default and remember user preferences.
```

### 2026-05-08-eslint-config
```md
Add latest eslint@10.3.0 with recommended settings.
```

### 2026-05-08-public-example-images
```md
Add public/examples/ folder and copy sakamoto.png/sensei.png/konata.png/kenny_chito.png/rwby_logos.png/chito_yuuri.png/hakumei_mikochi.jpg/zelda.jpg/silksong.jpg from ~/Pictures/inkako/ into it.
Add example image selection in the UI, and allow users to select and preview these example images.
`npm run build` should include these example images and `npm run dev` should serve them correctly.
```

### 2026-05-11-release-script
```md
Create a `scripts` directory and move the existing `build.mjs` script into it.
Add a new release script to bump version, create a version commit, tag the release, and push to the repository. Version rules should follow semantic versioning, and the script should accept a release type (patch, minor, major) as an argument, defaulting to patch if not provided. When not in master branch, the version should be bumped with a branch name suffix (e.g., `1.0.0-beta.1` in `beta` branch, `1.0.0-feature-xyz.1` in `feature/xyz` branch).
`package-lock.json` should be updated accordingly when the version is bumped.
Use `VERSION:` as git commit message beginning.
```

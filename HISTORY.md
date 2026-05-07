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

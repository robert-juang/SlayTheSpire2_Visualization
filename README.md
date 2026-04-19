# Slay the Spire 2 Team Visualizer

Electron + React macOS desktop app for importing Slay the Spire 2 `.run` files from Steam cache folders and visualizing team performance.

## Features

- Import `.run` files from one or more teammate Steam cache paths.
- Deduplicate imported runs by file content hash.
- Persist normalized run data to local SQLite.
- Explore dashboards for overview metrics, player comparison, and run explorer.

## Development

```bash
npm install
npm run dev
```

Renderer runs on Vite, Electron main process waits for renderer startup.

## Build

```bash
npm run build
npm run package
```

## Steam source path notes

Use folder paths that contain `.run` files (recursively scanned), for example:

`/Users/<name>/Library/Application Support/Steam/steamapps/common/SlayTheSpire2/runs`

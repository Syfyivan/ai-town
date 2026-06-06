# Local Visual Generation

The cinema visual explorer can run without an external API key.

There are two layers:

1. `convex/visuals.ts` builds the semantic `VisualNode` tree and stores generated images in Convex storage.
2. `scripts/visual-image-worker.mjs` is a local image worker. It returns an SVG fallback by default, or calls a local Stable Diffusion WebUI / Forge API when `SD_WEBUI_URL` is set.

## Run With SVG Fallback

```sh
npm run visual-worker
npx convex env set VISUAL_IMAGE_WORKER_URL http://127.0.0.1:8787
npm run dev
```

This proves the end-to-end flow without any model: click a hotspot, Convex calls the worker, the worker returns an image, and the next semantic node is stored.

## Run With Local Stable Diffusion

Start a local Stable Diffusion WebUI or Forge instance with API enabled, then point the worker at it:

```sh
SD_WEBUI_URL=http://127.0.0.1:7860 npm run visual-worker
npx convex env set VISUAL_IMAGE_WORKER_URL http://127.0.0.1:8787
npm run dev
```

When AI Town is running in Docker Compose, use the compose worker and route the Convex backend to the service name:

```sh
VISUAL_IMAGE_WORKER_URL=http://visual-worker:8787 \
docker compose -f docker-compose.yml -f docker-compose.visual-worker.yml up
```

If Stable Diffusion is running on the host while the worker is in Docker, pass:

```sh
SD_WEBUI_URL=http://host.docker.internal:7860
```

## Current Boundary

The app now preserves a semantic path: town overview -> resident house -> courtyard -> room -> furniture detail, and similar paths for river, market, cinema, and mountain road.

The generated image model still cannot truly inspect its own pixels and infer new hotspots. Hotspots are authored by the semantic node generator first, then the image prompt is produced from that node. This is the practical first version of the Flipbook-style interaction without needing a multimodal segmentation model.

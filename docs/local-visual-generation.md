# Local Visual Generation

The spyglass (观景台) visual explorer can run without an external API key.

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

## True-Flipbook: Click-Anywhere via a Vision Model

The spyglass (观景台) overlay now lets you click **anywhere** on the frame, not just the
authored hotspots. The click coordinate is sent to a vision-language model (`resolveClick`
in `convex/visuals.ts`), which says what is at that point; that phrase becomes the subject of
the next frame. This is the real Flipbook interaction — the hotspot tree below is only the
fallback when no vision model is configured.

The vision model uses a **dedicated** OpenAI-compatible endpoint, kept separate from the
town's main chat LLM (which is usually a non-vision Ollama model). Configure three env vars:

```sh
# Local, free: an Ollama vision model (e.g. llava, qwen2-vl, llama3.2-vision)
ollama pull llama3.2-vision
npx convex env set VISION_API_URL http://127.0.0.1:11434/v1
npx convex env set VISION_MODEL   llama3.2-vision
# VISION_API_KEY is optional for local Ollama.
```

```sh
# Hosted (one key, pay-as-you-go): OpenRouter / OpenAI / etc.
npx convex env set VISION_API_URL https://openrouter.ai/api/v1
npx convex env set VISION_MODEL   qwen/qwen2.5-vl-72b-instruct
npx convex env set VISION_API_KEY <your-key>
```

If `VISION_API_URL` / `VISION_MODEL` are unset, `resolveClick` returns `null` and the overlay
falls back to the suggested observation points (the authored hotspot tree). Note the vision
model must be able to fetch the frame's `imageUrl` (a Convex storage URL); for a local model
the Convex deployment URL must be reachable from where the model runs.

## World-Grounding

The root panorama is grounded in the **running** town. Before generating the overview frame,
`loadTownContext` reads `api.world.defaultWorldStatus` + `api.world.townObservatory` and injects
the residents' current activities and most recent memories into the image prompt. So the first
frame reflects what the AI townsfolk are actually doing right now, instead of a fixed template.
If the world query fails, grounding is skipped silently.

## Current Boundary

The app preserves a semantic path for the fallback tree: town overview -> resident house ->
courtyard -> room -> furniture detail, plus similar paths for river, market, spyglass and the
mountain road. With a vision model configured, exploration is no longer limited to that tree —
any clicked point becomes the next subject.

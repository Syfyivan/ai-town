/* eslint-disable @typescript-eslint/no-misused-promises, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { createServer } from 'node:http';

const port = Number(process.env.PORT ?? 8787);
const sdWebuiUrl = process.env.SD_WEBUI_URL?.replace(/\/$/, '');
const defaultWidth = Number(process.env.VISUAL_IMAGE_WIDTH ?? 1152);
const defaultHeight = Number(process.env.VISUAL_IMAGE_HEIGHT ?? 768);

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { ok: true, sdWebui: Boolean(sdWebuiUrl) });
      return;
    }

    if (request.method !== 'POST' || request.url !== '/generate') {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    const payload = await readJson(request);
    const width = clampSize(payload.width ?? defaultWidth);
    const height = clampSize(payload.height ?? defaultHeight);

    if (sdWebuiUrl) {
      const imageDataUrl = await generateWithStableDiffusion(payload, width, height);
      sendJson(response, 200, { imageDataUrl, source: 'sd-webui' });
      return;
    }

    sendJson(response, 200, {
      imageDataUrl: svgToDataUrl(renderFallbackSvg(payload, width, height)),
      source: 'local-svg-fallback',
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unknown image worker error',
    });
  }
});

server.listen(port, () => {
  console.log(`visual-image-worker listening on http://127.0.0.1:${port}`);
  if (sdWebuiUrl) {
    console.log(`SD WebUI endpoint: ${sdWebuiUrl}`);
  } else {
    console.log('SD_WEBUI_URL is not set; using local SVG fallback images.');
  }
});

async function generateWithStableDiffusion(payload, width, height) {
  const response = await fetch(`${sdWebuiUrl}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: [
        payload.prompt,
        'coherent recursive zoom, same place continuing deeper, hand painted pixel art, warm evening light',
        'clear composition, clickable landmarks, richly detailed environment',
      ]
        .filter(Boolean)
        .join(', '),
      negative_prompt:
        'blurry, low quality, unreadable text, watermark, logo, duplicated rooms, broken perspective, random world switch',
      width,
      height,
      steps: Number(process.env.SD_STEPS ?? 18),
      cfg_scale: Number(process.env.SD_CFG_SCALE ?? 6.5),
      sampler_name: process.env.SD_SAMPLER ?? 'DPM++ 2M Karras',
      batch_size: 1,
      n_iter: 1,
      seed: seededNumber(payload.nodeId ?? payload.title ?? payload.prompt),
    }),
  });

  if (!response.ok) {
    throw new Error(`SD WebUI returned ${response.status}`);
  }
  const data = await response.json();
  const image = data.images?.[0];
  if (!image) {
    throw new Error('SD WebUI response did not include an image');
  }
  return image.startsWith('data:') ? image : `data:image/png;base64,${image}`;
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error('Request body is too large'));
      }
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
  });
  response.end(JSON.stringify(value));
}

function clampSize(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return defaultWidth;
  }
  return Math.min(1536, Math.max(256, Math.round(number / 8) * 8));
}

function seededNumber(value) {
  const source = String(value ?? 'visual-node');
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function renderFallbackSvg(payload, width, height) {
  const seed = seededNumber(payload.nodeId ?? payload.title ?? payload.prompt);
  const palette = ['#101322', '#28305f', '#5acde8', '#fec742', '#dd7c42', '#63c2a5'];
  const hotspotShapes = (payload.hotspots ?? [])
    .map((spot, index) => renderHotspot(spot, index, width, height, palette))
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101322"/>
        <stop offset="0.48" stop-color="#28305f"/>
        <stop offset="1" stop-color="#0b5967"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="18"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#sky)"/>
    <circle cx="${width * 0.72}" cy="${height * 0.16}" r="${height * 0.22}" fill="#5acde8" opacity="0.17" filter="url(#soft)"/>
    ${renderMountains(width, height, seed)}
    ${renderTown(width, height, seed)}
    ${renderRiver(width, height, seed)}
    ${hotspotShapes}
    <rect x="${width * 0.03}" y="${height * 0.05}" width="${width * 0.94}" height="${height * 0.88}" rx="28" fill="none" stroke="#fec742" stroke-width="4" opacity="0.34"/>
  </svg>`;
}

function renderMountains(width, height, seed) {
  const points = Array.from({ length: 8 }, (_, index) => {
    const x = (index / 7) * width;
    const y = height * (0.52 - (((seed >> (index % 12)) & 7) / 100));
    return `${x},${y}`;
  }).join(' ');
  return `<polygon points="0,${height * 0.72} ${points} ${width},${height * 0.72} ${width},${height} 0,${height}" fill="#48cae4" opacity="0.32"/>`;
}

function renderTown(width, height, seed) {
  return Array.from({ length: 15 }, (_, index) => {
    const x = width * 0.07 + index * width * 0.06;
    const houseWidth = width * (0.035 + ((seed + index * 17) % 18) / 1000);
    const houseHeight = height * (0.09 + ((seed + index * 29) % 90) / 1000);
    const y = height * 0.68 - houseHeight + ((index % 3) * height) / 80;
    const roof = y - houseHeight * 0.28;
    const light = index % 2 === 0 ? '#fec742' : '#5acde8';
    return `<g opacity="0.86">
      <rect x="${x}" y="${y}" width="${houseWidth}" height="${houseHeight}" fill="#181425"/>
      <path d="M${x - 10} ${y} L${x + houseWidth / 2} ${roof} L${x + houseWidth + 10} ${y} Z" fill="#dd7c42"/>
      <rect x="${x + houseWidth * 0.34}" y="${y + houseHeight * 0.36}" width="${houseWidth * 0.24}" height="${houseHeight * 0.24}" fill="${light}" opacity="0.82"/>
    </g>`;
  }).join('');
}

function renderRiver(width, height) {
  return `<path d="M0 ${height * 0.76} C ${width * 0.18} ${height * 0.66}, ${width * 0.3} ${height * 0.86}, ${
    width * 0.48
  } ${height * 0.76} C ${width * 0.65} ${height * 0.66}, ${width * 0.76} ${height * 0.85}, ${
    width
  } ${height * 0.72} L ${width} ${height} L0 ${height} Z" fill="#f3d683" opacity="0.34"/>`;
}

function renderHotspot(spot, index, width, height, palette) {
  const x = Math.round(spot.rect.x * width);
  const y = Math.round(spot.rect.y * height);
  const w = Math.round(spot.rect.w * width);
  const h = Math.round(spot.rect.h * height);
  const color = palette[(index + 2) % palette.length];
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}" opacity="0.22" stroke="${color}" stroke-width="4"/>
  </g>`;
}

import { v } from 'convex/values';
import { ActionCtx, action, internalMutation, query } from './_generated/server';
import { api, internal } from './_generated/api';

const rectValidator = v.object({
  x: v.number(),
  y: v.number(),
  w: v.number(),
  h: v.number(),
});

const hotspotValidator = v.object({
  id: v.string(),
  label: v.string(),
  kind: v.string(),
  rect: rectValidator,
  nextPrompt: v.string(),
});

const parentNodeValidator = v.object({
  nodeId: v.string(),
  title: v.string(),
  prompt: v.string(),
  depth: v.number(),
  styleAnchor: v.string(),
});

const generatedNodeValidator = v.object({
  nodeId: v.string(),
  parentNodeId: v.optional(v.string()),
  title: v.string(),
  prompt: v.string(),
  depth: v.number(),
  styleAnchor: v.string(),
  imageStorageId: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  hotspots: v.array(hotspotValidator),
});

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type VisualHotspot = {
  id: string;
  label: string;
  kind: string;
  rect: Rect;
  nextPrompt: string;
};

type ParentNode = {
  nodeId: string;
  title: string;
  prompt: string;
  depth: number;
  styleAnchor: string;
};

type GeneratedNode = ParentNode & {
  parentNodeId?: string;
  imageStorageId?: string;
  imageUrl?: string;
  hotspots: VisualHotspot[];
};

type WorkerResponse = {
  imageUrl?: string;
  imageDataUrl?: string;
};

const ROOT_STYLE =
  '溪山镇，温暖黄昏，像素风与手绘绘本结合，统一建筑样式，柔和灯光，细节丰富但构图清晰';

export const listSessionNodes = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('visualNodes')
      .withIndex('sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('asc')
      .collect();
  },
});

export const saveVisualNode = internalMutation({
  args: {
    sessionId: v.string(),
    node: generatedNodeValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('visualNodes')
      .withIndex('nodeId', (q) => q.eq('sessionId', args.sessionId).eq('nodeId', args.node.nodeId))
      .first();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert('visualNodes', {
      sessionId: args.sessionId,
      nodeId: args.node.nodeId,
      parentNodeId: args.node.parentNodeId,
      title: args.node.title,
      prompt: args.node.prompt,
      depth: args.node.depth,
      styleAnchor: args.node.styleAnchor,
      imageStorageId: args.node.imageStorageId,
      imageUrl: args.node.imageUrl,
      hotspots: args.node.hotspots,
      createdAt: Date.now(),
    });
  },
});

export const generateNextNode = action({
  args: {
    sessionId: v.string(),
    parent: v.optional(parentNodeValidator),
    hotspot: v.optional(hotspotValidator),
    // Free-form subject resolved by the vision model from a click on the previous
    // frame. When present we follow it instead of the hand-authored hotspot tree.
    subject: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<GeneratedNode> => {
    let node =
      args.parent && args.subject
        ? buildSubjectNode(args.parent, args.subject)
        : buildNextNode(args.parent, args.hotspot);
    // World-grounding: the root panorama reflects what is actually happening in the
    // running town right now, so the spyglass shows a real world, not a hallucination.
    if (!args.parent) {
      const townContext = await loadTownContext(ctx);
      if (townContext) {
        node = { ...node, prompt: `${node.prompt} 此刻镇上的真实状况：${townContext}` };
      }
    }
    const image = await generateImage(ctx, node);
    const generatedNode = {
      ...node,
      imageStorageId: image.imageStorageId,
      imageUrl: image.imageUrl,
    };
    await ctx.runMutation(internal.visuals.saveVisualNode, {
      sessionId: args.sessionId,
      node: generatedNode,
    });
    return generatedNode;
  },
});

// ---------------------------------------------------------------------------
// True-Flipbook click resolution: turn a click coordinate into a semantic
// subject by asking a vision model what is at that point. This uses a dedicated
// vision endpoint (VISION_API_URL / VISION_MODEL / VISION_API_KEY) so it stays
// decoupled from the town's main chat LLM (which may be a non-vision Ollama model).
// When unconfigured it returns null and the frontend falls back to the hotspot tree.
// ---------------------------------------------------------------------------

function getVisionConfig() {
  const url = process.env.VISION_API_URL;
  const model = process.env.VISION_MODEL;
  if (!url || !model) {
    return null;
  }
  return { url: url.replace(/\/$/, ''), model, apiKey: process.env.VISION_API_KEY };
}

export const resolveClick = action({
  args: {
    imageUrl: v.string(),
    x: v.number(),
    y: v.number(),
    title: v.string(),
    path: v.array(v.string()),
  },
  handler: async (_ctx, args): Promise<{ subject: string } | null> => {
    const config = getVisionConfig();
    if (!config) {
      return null;
    }
    // Inline the frame as a base64 data URL. Many local vision servers (e.g. Ollama)
    // do not fetch remote image_url values, so we download the bytes ourselves and
    // embed them — this works uniformly across local and hosted providers.
    let imageContent = args.imageUrl;
    try {
      const imageResponse = await fetch(args.imageUrl);
      if (imageResponse.ok) {
        const buffer = new Uint8Array(await imageResponse.arrayBuffer());
        let binary = '';
        for (let i = 0; i < buffer.length; i += 1) {
          binary += String.fromCharCode(buffer[i]);
        }
        const contentType = imageResponse.headers.get('content-type') ?? 'image/png';
        imageContent = `data:${contentType};base64,${btoa(binary)}`;
      }
    } catch (imageError) {
      console.warn('resolveClick could not inline image, falling back to URL', imageError);
    }
    try {
      const response = await fetch(`${config.url}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: config.model,
          temperature: 0.2,
          max_tokens: 32,
          messages: [
            {
              role: 'system',
              content:
                '你在看一张溪山镇的画面。用户点击了画面上的某个位置（坐标已归一化到 0~1，左上角为原点）。' +
                '请用一个不超过 12 个汉字的中文名词短语，描述那个位置上最显眼的东西，作为继续放大探索的主体。' +
                '只输出这个短语本身，不要加引号、标点或解释。',
            },
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: imageContent } },
                {
                  type: 'text',
                  text:
                    `当前画面：「${args.title}」。点击位置 x=${args.x.toFixed(3)}, y=${args.y.toFixed(3)}。` +
                    `已走过的探索路径：${args.path.join(' → ') || '（这是起点）'}。`,
                },
              ],
            },
          ],
        }),
      });
      if (!response.ok) {
        console.warn('resolveClick vision call failed', response.status, await response.text());
        return null;
      }
      const json = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const raw = json.choices?.[0]?.message?.content?.trim();
      if (!raw) {
        return null;
      }
      const subject = raw.replace(/^["'“”「」]+|["'“”「」]+$/g, '').slice(0, 24);
      return subject ? { subject } : null;
    } catch (error) {
      console.warn('resolveClick error', error);
      return null;
    }
  },
});

async function loadTownContext(ctx: ActionCtx): Promise<string | undefined> {
  try {
    const status = await ctx.runQuery(api.world.defaultWorldStatus, {});
    if (!status) {
      return undefined;
    }
    const observatory = await ctx.runQuery(api.world.townObservatory, {
      worldId: status.worldId,
    });
    const activities = (observatory.activeActivities ?? [])
      .slice(0, 4)
      .map((activity) => `${activity.player}正在${activity.description}`);
    const memories = (observatory.recentMemories ?? [])
      .slice(0, 3)
      .map((memory) => `${memory.owner}：${memory.description}`);
    const parts = [...activities, ...memories].filter(Boolean);
    if (!parts.length) {
      return undefined;
    }
    return parts.join('；').slice(0, 300);
  } catch (error) {
    console.warn('loadTownContext failed', error);
    return undefined;
  }
}

function buildSubjectNode(parent: ParentNode, subject: string): GeneratedNode {
  const depth = parent.depth + 1;
  const safeSubject = subject.slice(0, 24);
  return {
    nodeId: `${parent.nodeId}-vlm-${depth}`,
    parentNodeId: parent.nodeId,
    title: safeSubject,
    prompt:
      `放大并深入“${safeSubject}”，把它展开成下一层更近、更具体的可探索场景。` +
      `保持来自上一层“${parent.title}”的视觉连续性。`,
    depth,
    styleAnchor: parent.styleAnchor,
    hotspots: [
      makeHotspot('left-detail', '左侧', 'object', { x: 0.12, y: 0.34, w: 0.22, h: 0.28 }),
      makeHotspot('center-detail', '中心', 'object', { x: 0.4, y: 0.3, w: 0.24, h: 0.34 }),
      makeHotspot('right-detail', '右侧', 'object', { x: 0.7, y: 0.4, w: 0.18, h: 0.26 }),
    ],
  };
}

function buildNextNode(parent?: ParentNode, selectedHotspot?: VisualHotspot): GeneratedNode {
  if (!parent || !selectedHotspot) {
    return {
      nodeId: 'town-overview',
      title: '溪山镇全景',
      prompt:
        '溪山镇全景，画面中有居民家、河边小桥、市集、山坡上的观景台和通往山里的小路，适合作为可点击探索地图。',
      depth: 0,
      styleAnchor: ROOT_STYLE,
      hotspots: [
        makeHotspot('resident-house', '居民家', 'house', { x: 0.12, y: 0.36, w: 0.22, h: 0.34 }),
        makeHotspot('riverside', '河边小桥', 'river', { x: 0.39, y: 0.55, w: 0.25, h: 0.22 }),
        makeHotspot('market', '市集', 'market', { x: 0.65, y: 0.4, w: 0.22, h: 0.28 }),
        makeHotspot('spyglass', '观景台', 'spyglass', { x: 0.76, y: 0.18, w: 0.16, h: 0.18 }),
        makeHotspot('mountain-road', '山路', 'road', { x: 0.03, y: 0.62, w: 0.22, h: 0.26 }),
      ],
    };
  }

  const depth = parent.depth + 1;
  const nodeId = `${parent.nodeId}-${selectedHotspot.id}-${depth}`;
  const styleAnchor = parent.styleAnchor;
  const next = buildSemanticChild(parent, selectedHotspot, depth);
  return {
    nodeId,
    parentNodeId: parent.nodeId,
    title: next.title,
    prompt: `${selectedHotspot.nextPrompt}。保持来自上一层“${parent.title}”的视觉连续性。${next.prompt}`,
    depth,
    styleAnchor,
    hotspots: next.hotspots,
  };
}

function makeHotspot(id: string, label: string, kind: string, rect: Rect): VisualHotspot {
  return {
    id,
    label,
    kind,
    rect,
    nextPrompt: nextPromptFor(label, kind),
  };
}

function nextPromptFor(label: string, kind: string) {
  const prompts: Record<string, string> = {
    house: `进入${label}的院子，看到院门、窗户、台阶、花盆和门口灯笼`,
    door: `穿过${label}，进入这栋房子的内部空间`,
    room: `靠近${label}，展开这个房间里的细节`,
    furniture: `仔细观察${label}，看到纹理、摆件、抽屉和被使用过的痕迹`,
    river: `沿着${label}靠近水面，看到倒影、桥洞和漂浮的灯`,
    market: `进入${label}，看到摊位、商品、招牌和小镇居民留下的物品`,
    spyglass: `登上${label}，看到望远镜、星图、栏杆和俯瞰小镇的视野`,
    road: `沿着${label}前进，看到石阶、草丛、路牌和远处山门`,
    object: `继续放大${label}，把它展开成下一层可探索场景`,
  };
  return prompts[kind] ?? prompts.object;
}

function buildSemanticChild(
  parent: ParentNode,
  selectedHotspot: VisualHotspot,
  depth: number,
): { title: string; prompt: string; hotspots: VisualHotspot[] } {
  if (selectedHotspot.kind === 'house') {
    return {
      title: `${selectedHotspot.label}的院子`,
      prompt: '院子里有木门、石阶、窗户、晾衣绳、水井、花坛和通向后院的小径。',
      hotspots: [
        makeHotspot('front-door', '房门', 'door', { x: 0.43, y: 0.34, w: 0.18, h: 0.34 }),
        makeHotspot('window', '亮着灯的窗户', 'room', { x: 0.2, y: 0.3, w: 0.18, h: 0.2 }),
        makeHotspot('well', '水井', 'object', { x: 0.68, y: 0.58, w: 0.18, h: 0.22 }),
        makeHotspot('garden', '花坛', 'object', { x: 0.13, y: 0.66, w: 0.25, h: 0.18 }),
      ],
    };
  }
  if (selectedHotspot.kind === 'door') {
    return {
      title: `${parent.title}的室内`,
      prompt: '进入房间内部，能看到木地板、书架、餐桌、柜子、壁炉、挂画和窗边植物。',
      hotspots: [
        makeHotspot('bookshelf', '书架', 'furniture', { x: 0.08, y: 0.22, w: 0.22, h: 0.48 }),
        makeHotspot('table', '餐桌', 'furniture', { x: 0.38, y: 0.5, w: 0.24, h: 0.24 }),
        makeHotspot('cabinet', '柜子', 'furniture', { x: 0.7, y: 0.28, w: 0.2, h: 0.36 }),
        makeHotspot('stair', '阁楼楼梯', 'room', { x: 0.6, y: 0.08, w: 0.18, h: 0.3 }),
      ],
    };
  }
  if (selectedHotspot.kind === 'furniture') {
    return {
      title: `${selectedHotspot.label}的细节`,
      prompt: `极近距离观察${selectedHotspot.label}，看到小物件、手写标签、旧照片、木纹和隐藏的抽屉。`,
      hotspots: [
        makeHotspot('drawer', '半开的抽屉', 'object', { x: 0.16, y: 0.48, w: 0.26, h: 0.22 }),
        makeHotspot('photo', '旧照片', 'object', { x: 0.55, y: 0.2, w: 0.2, h: 0.18 }),
        makeHotspot('note', '手写便签', 'object', { x: 0.62, y: 0.58, w: 0.24, h: 0.2 }),
      ],
    };
  }
  if (selectedHotspot.kind === 'river') {
    return {
      title: `${selectedHotspot.label}的倒影`,
      prompt: '靠近河面，水里倒映着房屋、桥洞、灯笼和一条通向水下空间的微光路径。',
      hotspots: [
        makeHotspot('bridge-arch', '桥洞', 'object', { x: 0.38, y: 0.25, w: 0.26, h: 0.24 }),
        makeHotspot('reflection', '水面倒影', 'object', { x: 0.22, y: 0.52, w: 0.36, h: 0.28 }),
        makeHotspot('floating-lantern', '漂浮灯笼', 'object', { x: 0.68, y: 0.56, w: 0.18, h: 0.18 }),
      ],
    };
  }
  if (selectedHotspot.kind === 'market') {
    return {
      title: `${selectedHotspot.label}摊位`,
      prompt: '进入市集，近处有水果摊、旧书摊、茶壶、布匹、木牌价签和人们留下的便条。',
      hotspots: [
        makeHotspot('fruit-stand', '水果摊', 'object', { x: 0.1, y: 0.42, w: 0.28, h: 0.28 }),
        makeHotspot('book-stand', '旧书摊', 'furniture', { x: 0.44, y: 0.32, w: 0.24, h: 0.28 }),
        makeHotspot('tea-pot', '茶壶', 'object', { x: 0.72, y: 0.5, w: 0.16, h: 0.18 }),
      ],
    };
  }
  if (selectedHotspot.kind === 'spyglass') {
    return {
      title: `${selectedHotspot.label}观测平台`,
      prompt: '登上观景台平台，看到一架黄铜望远镜、墙上的星图、木栏杆和俯瞰整座溪山镇的视野。',
      hotspots: [
        makeHotspot('telescope', '黄铜望远镜', 'object', { x: 0.42, y: 0.22, w: 0.2, h: 0.44 }),
        makeHotspot('star-map', '星图', 'object', { x: 0.12, y: 0.22, w: 0.22, h: 0.3 }),
        makeHotspot('overlook', '俯瞰小镇的视野', 'road', { x: 0.68, y: 0.48, w: 0.2, h: 0.2 }),
      ],
    };
  }

  return {
    title: `${selectedHotspot.label}深处`,
    prompt: `继续从${selectedHotspot.label}向内延伸，生成一个更细、更近、更具体的可探索空间。深度 ${depth}。`,
    hotspots: [
      makeHotspot('left-detail', '左侧细节', 'object', { x: 0.12, y: 0.34, w: 0.22, h: 0.28 }),
      makeHotspot('center-detail', '中心细节', 'object', { x: 0.4, y: 0.3, w: 0.24, h: 0.34 }),
      makeHotspot('right-detail', '右侧细节', 'object', { x: 0.7, y: 0.4, w: 0.18, h: 0.26 }),
    ],
  };
}

async function generateImage(
  ctx: ActionCtx,
  node: GeneratedNode,
): Promise<{ imageUrl: string; imageStorageId?: string }> {
  const workerUrl = process.env.VISUAL_IMAGE_WORKER_URL;
  if (workerUrl) {
    try {
      const response = await fetch(`${workerUrl.replace(/\/$/, '')}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nodeId: node.nodeId,
          title: node.title,
          prompt: `${node.styleAnchor}。${node.prompt}`,
          hotspots: node.hotspots,
          width: 1152,
          height: 768,
        }),
      });
      if (!response.ok) {
        throw new Error(`Image worker returned ${response.status}`);
      }
      const workerResponse = (await response.json()) as WorkerResponse;
      if (workerResponse.imageUrl) {
        return { imageUrl: workerResponse.imageUrl };
      }
      if (workerResponse.imageDataUrl) {
        return await storeDataUrl(ctx, workerResponse.imageDataUrl);
      }
    } catch (error) {
      console.warn('Falling back to SVG visual node image', error);
    }
  }
  return await storeDataUrl(ctx, svgToDataUrl(renderFallbackSvg(node)));
}

async function storeDataUrl(ctx: ActionCtx, dataUrl: string) {
  const blob = dataUrlToBlob(dataUrl);
  const imageStorageId = await ctx.storage.store(blob);
  const imageUrl = await ctx.storage.getUrl(imageStorageId);
  if (!imageUrl) {
    throw new Error(`Could not resolve generated image ${imageStorageId}`);
  }
  return { imageUrl, imageStorageId };
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Image worker returned an invalid data URL');
  }
  const [, mimeType, base64Flag, body] = match;
  const bytes =
    base64Flag === ';base64'
      ? Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
      : new TextEncoder().encode(decodeURIComponent(body));
  return new Blob([bytes], { type: mimeType });
}

function renderFallbackSvg(node: GeneratedNode) {
  const palette = ['#101322', '#28305f', '#5acde8', '#fec742', '#dd7c42'];
  const hotspotShapes = node.hotspots
    .map((spot, index) => {
      const x = Math.round(spot.rect.x * 1152);
      const y = Math.round(spot.rect.y * 768);
      const w = Math.round(spot.rect.w * 1152);
      const h = Math.round(spot.rect.h * 768);
      const color = palette[(index + 2) % palette.length];
      return `<g>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${color}" opacity="0.24" stroke="${color}" stroke-width="4"/>
      </g>`;
    })
    .join('');

  return `<svg width="1152" height="768" viewBox="0 0 1152 768" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101322"/>
        <stop offset="0.45" stop-color="#28305f"/>
        <stop offset="1" stop-color="#0b5967"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="16"/></filter>
    </defs>
    <rect width="1152" height="768" fill="url(#sky)"/>
    <circle cx="760" cy="120" r="170" fill="#5acde8" opacity="0.18" filter="url(#soft)"/>
    <path d="M0 520 L160 390 L300 500 L470 330 L620 475 L790 360 L1152 540 L1152 768 L0 768 Z" fill="#48cae4" opacity="0.36"/>
    <path d="M0 610 C160 550 260 680 420 610 C580 540 690 650 850 590 C980 540 1080 600 1152 570 L1152 768 L0 768 Z" fill="#f3d683" opacity="0.34"/>
    ${renderFallbackBuildings(node.depth)}
    ${hotspotShapes}
    <rect x="36" y="36" width="1080" height="696" rx="28" fill="none" stroke="#fec742" stroke-width="4" opacity="0.32"/>
  </svg>`;
}

function renderFallbackBuildings(depth: number) {
  const buildings = [];
  for (let i = 0; i < 13; i += 1) {
    const x = 65 + i * 82;
    const h = 90 + ((i * 29 + depth * 37) % 120);
    const y = 560 - h;
    buildings.push(`<g>
      <rect x="${x}" y="${y}" width="58" height="${h}" fill="#181425" opacity="0.78"/>
      <path d="M${x - 10} ${y} L${x + 29} ${y - 48} L${x + 68} ${y} Z" fill="#dd7c42"/>
      <rect x="${x + 15}" y="${y + 42}" width="16" height="26" fill="#fec742" opacity="0.82"/>
      <rect x="${x + 38}" y="${y + 72}" width="14" height="22" fill="#5acde8" opacity="0.82"/>
    </g>`);
  }
  return buildings.join('');
}

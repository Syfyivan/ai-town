import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { characters } from '../data/characters';
import { insertInput } from './aiTown/insertInput';
import {
  DEFAULT_NAME,
  ENGINE_ACTION_DURATION,
  IDLE_WORLD_TIMEOUT,
  WORLD_HEARTBEAT_INTERVAL,
} from './constants';
import { playerId } from './aiTown/ids';
import { kickEngine, startEngine, stopEngine } from './aiTown/main';
import { engineInsertInput } from './engine/abstractGame';
import type { DatabaseReader } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';

export const NPC_NAME_MAX_LENGTH = 16;
export const NPC_IDENTITY_MAX_LENGTH = 500;
export const NPC_PLAN_MAX_LENGTH = 220;
export const ART_STUDIO_SHIFT_DURATION_MS = 60_000;
export const GARDEN_PLOT_COUNT = 4;
export const PLAYER_NAME_MAX_LENGTH = 16;
export const PLAYER_SESSION_MAX_LENGTH = 80;

export type StudioFocus = 'sketch' | 'color' | 'detail';
export type GardenCropId = 'radish' | 'greens' | 'carrot';

export type StudioWorkerStats = {
  florins: number;
  paintingSkill: number;
  creativity: number;
  reputation: number;
  shiftsCompleted: number;
};

export type ArtStudioShift = {
  focus: StudioFocus;
  title: string;
  description: string;
  startedAt: number;
  endsAt: number;
  basePay: number;
  skillGain: number;
  creativityGain: number;
  reputationGain: number;
};

export type GardenPlot = {
  slot: number;
  crop?: GardenCropId;
  plantedAt?: number;
  wateredAt?: number;
  readyAt?: number;
};

export type GardenerStats = {
  coins: number;
  vegetables: number;
  gardeningSkill: number;
  harvestsCompleted: number;
};

export type GardenPlotPhase = 'empty' | 'planted' | 'watered' | 'ready';

const studioFocus = v.union(v.literal('sketch'), v.literal('color'), v.literal('detail'));
const gardenCrop = v.union(v.literal('radish'), v.literal('greens'), v.literal('carrot'));

const INITIAL_STUDIO_WORKER: StudioWorkerStats = {
  florins: 0,
  paintingSkill: 1,
  creativity: 1,
  reputation: 0,
  shiftsCompleted: 0,
};

const STUDIO_FOCUS_CONFIG: Record<
  StudioFocus,
  {
    title: string;
    description: string;
    basePay: number;
    skillGain: number;
    creativityGain: number;
    reputationGain: number;
  }
> = {
  sketch: {
    title: '构图打底',
    description: '跟着画室老板给客户订单起草线稿，速度快，适合新手熟悉流程。',
    basePay: 18,
    skillGain: 0.8,
    creativityGain: 0.4,
    reputationGain: 1,
  },
  color: {
    title: '调色上色',
    description: '在调色台旁准备颜料并完成大色块，能更快积累创造力。',
    basePay: 20,
    skillGain: 0.5,
    creativityGain: 0.8,
    reputationGain: 1,
  },
  detail: {
    title: '精修装裱',
    description: '处理边缘、署名和装裱，报酬略高，但更依赖绘画能力。',
    basePay: 24,
    skillGain: 0.9,
    creativityGain: 0.5,
    reputationGain: 1,
  },
};

const INITIAL_GARDENER_STATS: GardenerStats = {
  coins: 0,
  vegetables: 0,
  gardeningSkill: 1,
  harvestsCompleted: 0,
};

const GARDEN_CROP_CONFIG: Record<
  GardenCropId,
  {
    name: string;
    description: string;
    growMs: number;
    yieldVegetables: number;
    coinReward: number;
    skillGain: number;
  }
> = {
  radish: {
    name: '萝卜',
    description: '长得快，适合验证菜园循环。',
    growMs: 45_000,
    yieldVegetables: 1,
    coinReward: 8,
    skillGain: 0.4,
  },
  greens: {
    name: '青菜',
    description: '收益稳定，小镇茶铺常收。',
    growMs: 60_000,
    yieldVegetables: 2,
    coinReward: 10,
    skillGain: 0.5,
  },
  carrot: {
    name: '胡萝卜',
    description: '成熟稍慢，报酬更好。',
    growMs: 75_000,
    yieldVegetables: 2,
    coinReward: 14,
    skillGain: 0.7,
  },
};

export function sanitizePlayerName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return DEFAULT_NAME;
  }
  return trimmed.slice(0, PLAYER_NAME_MAX_LENGTH);
}

export function buildSessionToken(sessionId: string) {
  const trimmed = sessionId.trim();
  if (!trimmed) {
    throw new Error('Missing player session.');
  }
  const safeSessionId = trimmed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, PLAYER_SESSION_MAX_LENGTH);
  if (!safeSessionId) {
    throw new Error('Invalid player session.');
  }
  return `local:${safeSessionId}`;
}

export function selectSessionCharacter(sessionId: string) {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i += 1) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  }
  return characters[hash % characters.length].name;
}

export type NpcProfileInput = {
  name: string;
  character: string;
  identity: string;
  plan: string;
};

export function sanitizeNpcProfile(input: NpcProfileInput) {
  const name = input.name.trim();
  const character = input.character.trim();
  const identity = input.identity.trim();
  const plan = input.plan.trim();

  if (!name) {
    throw new Error('NPC name is required');
  }
  if (name.length > NPC_NAME_MAX_LENGTH) {
    throw new Error(`NPC name cannot exceed ${NPC_NAME_MAX_LENGTH} characters`);
  }
  if (!characters.some((c) => c.name === character)) {
    throw new Error(`Unknown NPC character sprite: ${character}`);
  }
  if (!identity) {
    throw new Error('NPC identity is required');
  }
  if (identity.length > NPC_IDENTITY_MAX_LENGTH) {
    throw new Error(`NPC identity cannot exceed ${NPC_IDENTITY_MAX_LENGTH} characters`);
  }
  if (!plan) {
    throw new Error('NPC goal is required');
  }
  if (plan.length > NPC_PLAN_MAX_LENGTH) {
    throw new Error(`NPC goal cannot exceed ${NPC_PLAN_MAX_LENGTH} characters`);
  }
  return { name, character, identity, plan };
}

function roundStudioStat(value: number) {
  return Math.round(value * 10) / 10;
}

export function getStudioShiftProgress(now: number, shift: Pick<ArtStudioShift, 'startedAt' | 'endsAt'>) {
  const duration = shift.endsAt - shift.startedAt;
  if (duration <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, (now - shift.startedAt) / duration));
}

export function createArtStudioShift(
  focus: StudioFocus,
  worker: StudioWorkerStats,
  now: number,
): ArtStudioShift {
  const config = STUDIO_FOCUS_CONFIG[focus];
  const growthBonus = Math.floor((worker.paintingSkill + worker.creativity + worker.reputation) / 3);
  return {
    focus,
    title: config.title,
    description: config.description,
    startedAt: now,
    endsAt: now + ART_STUDIO_SHIFT_DURATION_MS,
    basePay: config.basePay + growthBonus,
    skillGain: config.skillGain,
    creativityGain: config.creativityGain,
    reputationGain: config.reputationGain,
  };
}

export function settleArtStudioShift(
  worker: StudioWorkerStats,
  shift: Pick<ArtStudioShift, 'basePay' | 'skillGain' | 'creativityGain' | 'reputationGain'>,
): StudioWorkerStats {
  return {
    florins: worker.florins + shift.basePay,
    paintingSkill: roundStudioStat(worker.paintingSkill + shift.skillGain),
    creativity: roundStudioStat(worker.creativity + shift.creativityGain),
    reputation: worker.reputation + shift.reputationGain,
    shiftsCompleted: worker.shiftsCompleted + 1,
  };
}

export function previewArtStudioJobs(worker: StudioWorkerStats) {
  return (Object.keys(STUDIO_FOCUS_CONFIG) as StudioFocus[]).map((focus) => {
    const shift = createArtStudioShift(focus, worker, 0);
    return {
      focus,
      title: shift.title,
      description: shift.description,
      payPreview: shift.basePay,
      skillGain: shift.skillGain,
      creativityGain: shift.creativityGain,
      durationMs: ART_STUDIO_SHIFT_DURATION_MS,
    };
  });
}

export function createGardenPlots(): GardenPlot[] {
  return Array.from({ length: GARDEN_PLOT_COUNT }, (_, slot) => ({ slot }));
}

function ensureGardenPlots(plots?: GardenPlot[]): GardenPlot[] {
  const bySlot = new Map((plots ?? []).map((plot) => [plot.slot, plot]));
  return createGardenPlots().map((emptyPlot) => bySlot.get(emptyPlot.slot) ?? emptyPlot);
}

function findGardenPlot(plots: GardenPlot[], slot: number) {
  const plot = plots.find((candidate) => candidate.slot === slot);
  if (!plot) {
    throw new Error(`Invalid garden plot slot: ${slot}`);
  }
  return plot;
}

function replaceGardenPlot(plots: GardenPlot[], nextPlot: GardenPlot) {
  return plots.map((plot) => (plot.slot === nextPlot.slot ? nextPlot : plot));
}

export function getGardenPlotPhase(now: number, plot: GardenPlot): GardenPlotPhase {
  if (!plot.crop) {
    return 'empty';
  }
  if (plot.readyAt && now >= plot.readyAt) {
    return 'ready';
  }
  if (plot.wateredAt) {
    return 'watered';
  }
  return 'planted';
}

export function plantGardenPlot(
  plots: GardenPlot[],
  slot: number,
  crop: GardenCropId,
  now: number,
) {
  const normalizedPlots = ensureGardenPlots(plots);
  const plot = findGardenPlot(normalizedPlots, slot);
  if (getGardenPlotPhase(now, plot) !== 'empty') {
    throw new Error('这块地已经种了作物。');
  }
  return replaceGardenPlot(normalizedPlots, {
    slot,
    crop,
    plantedAt: now,
  });
}

export function waterGardenPlot(plots: GardenPlot[], slot: number, now: number) {
  const normalizedPlots = ensureGardenPlots(plots);
  const plot = findGardenPlot(normalizedPlots, slot);
  const phase = getGardenPlotPhase(now, plot);
  if (phase === 'empty') {
    throw new Error('这块地还没有播种。');
  }
  if (phase === 'watered' || phase === 'ready') {
    throw new Error('这块地今天已经浇过水了。');
  }
  const cropConfig = GARDEN_CROP_CONFIG[plot.crop!];
  return replaceGardenPlot(normalizedPlots, {
    ...plot,
    wateredAt: now,
    readyAt: now + cropConfig.growMs,
  });
}

export function harvestGardenPlot(
  stats: GardenerStats,
  plots: GardenPlot[],
  slot: number,
  now: number,
) {
  const normalizedPlots = ensureGardenPlots(plots);
  const plot = findGardenPlot(normalizedPlots, slot);
  if (getGardenPlotPhase(now, plot) !== 'ready') {
    throw new Error('这块地还没成熟。');
  }
  const cropConfig = GARDEN_CROP_CONFIG[plot.crop!];
  const nextStats = {
    coins: stats.coins + cropConfig.coinReward,
    vegetables: stats.vegetables + cropConfig.yieldVegetables,
    gardeningSkill: roundStudioStat(stats.gardeningSkill + cropConfig.skillGain),
    harvestsCompleted: stats.harvestsCompleted + 1,
  };
  return {
    stats: nextStats,
    plots: replaceGardenPlot(normalizedPlots, { slot }),
    harvest: {
      crop: plot.crop!,
      cropName: cropConfig.name,
      coinReward: cropConfig.coinReward,
      vegetables: cropConfig.yieldVegetables,
      skillGain: cropConfig.skillGain,
    },
  };
}

export function previewGardenCrops() {
  return (Object.keys(GARDEN_CROP_CONFIG) as GardenCropId[]).map((crop) => ({
    crop,
    ...GARDEN_CROP_CONFIG[crop],
  }));
}

export function summarizeResidentAssets(
  worker?: StudioWorkerStats,
  gardener?: GardenerStats,
) {
  return {
    florins: worker?.florins ?? 0,
    coins: gardener?.coins ?? 0,
    vegetables: gardener?.vegetables ?? 0,
    paintingSkill: worker?.paintingSkill ?? INITIAL_STUDIO_WORKER.paintingSkill,
    creativity: worker?.creativity ?? INITIAL_STUDIO_WORKER.creativity,
    reputation: worker?.reputation ?? INITIAL_STUDIO_WORKER.reputation,
    gardeningSkill: gardener?.gardeningSkill ?? INITIAL_GARDENER_STATS.gardeningSkill,
    shiftsCompleted: worker?.shiftsCompleted ?? 0,
    harvestsCompleted: gardener?.harvestsCompleted ?? 0,
  };
}

function artStudioStatsFromWorker(worker?: Doc<'artStudioWorkers'>): StudioWorkerStats {
  if (!worker) {
    return INITIAL_STUDIO_WORKER;
  }
  return {
    florins: worker.florins,
    paintingSkill: worker.paintingSkill,
    creativity: worker.creativity,
    reputation: worker.reputation,
    shiftsCompleted: worker.shiftsCompleted,
  };
}

function gardenerStatsFromRecord(gardener?: Doc<'gardeners'>): GardenerStats {
  if (!gardener) {
    return INITIAL_GARDENER_STATS;
  }
  return {
    coins: gardener.coins,
    vegetables: gardener.vegetables,
    gardeningSkill: gardener.gardeningSkill,
    harvestsCompleted: gardener.harvestsCompleted,
  };
}

async function findArtStudioWorker(
  db: DatabaseReader,
  worldId: Id<'worlds'>,
  workerPlayerId: string,
) {
  return await db
    .query('artStudioWorkers')
    .withIndex('worldPlayer', (q) => q.eq('worldId', worldId).eq('playerId', workerPlayerId))
    .unique();
}

async function findGardener(db: DatabaseReader, worldId: Id<'worlds'>, gardenerPlayerId: string) {
  return await db
    .query('gardeners')
    .withIndex('worldPlayer', (q) => q.eq('worldId', worldId).eq('playerId', gardenerPlayerId))
    .unique();
}

async function getPlayerDisplayName(
  db: DatabaseReader,
  worldId: Id<'worlds'>,
  workerPlayerId: string,
) {
  const description = await db
    .query('playerDescriptions')
    .withIndex('worldId', (q) => q.eq('worldId', worldId).eq('playerId', workerPlayerId))
    .unique();
  return description?.name ?? workerPlayerId;
}

function requireHumanPlayer(world: Doc<'worlds'>, workerPlayerId: string) {
  const player = world.players.find((candidate) => candidate.id === workerPlayerId);
  if (!player) {
    throw new Error(`Invalid player ID: ${workerPlayerId}`);
  }
  if (!player.human) {
    throw new Error('Only a joined human player can work in the art studio');
  }
  return player;
}

export const defaultWorldStatus = query({
  handler: async (ctx) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .filter((q) => q.eq(q.field('isDefault'), true))
      .first();
    return worldStatus;
  },
});

export const heartbeatWorld = mutation({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!worldStatus) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    const now = Date.now();

    // Skip the update (and then potentially make the transaction readonly)
    // if it's been viewed sufficiently recently..
    if (!worldStatus.lastViewed || worldStatus.lastViewed < now - WORLD_HEARTBEAT_INTERVAL / 2) {
      await ctx.db.patch(worldStatus._id, {
        lastViewed: Math.max(worldStatus.lastViewed ?? now, now),
      });
    }

    // Restart inactive worlds, but leave worlds explicitly stopped by the developer alone.
    if (worldStatus.status === 'stoppedByDeveloper') {
      console.debug(`World ${worldStatus._id} is stopped by developer, not restarting.`);
    }
    if (worldStatus.status === 'inactive') {
      console.log(`Restarting inactive world ${worldStatus._id}...`);
      await ctx.db.patch(worldStatus._id, { status: 'running' });
      await startEngine(ctx, worldStatus.worldId);
    }
  },
});

export const stopInactiveWorlds = internalMutation({
  handler: async (ctx) => {
    const cutoff = Date.now() - IDLE_WORLD_TIMEOUT;
    const worlds = await ctx.db.query('worldStatus').collect();
    for (const worldStatus of worlds) {
      if (cutoff < worldStatus.lastViewed || worldStatus.status !== 'running') {
        continue;
      }
      console.log(`Stopping inactive world ${worldStatus._id}`);
      await ctx.db.patch(worldStatus._id, { status: 'inactive' });
      await stopEngine(ctx, worldStatus.worldId);
    }
  },
});

export const restartDeadWorlds = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();

    // Restart an engine if it hasn't run for 2x its action duration.
    const engineTimeout = now - ENGINE_ACTION_DURATION * 2;
    const worlds = await ctx.db.query('worldStatus').collect();
    for (const worldStatus of worlds) {
      if (worldStatus.status !== 'running') {
        continue;
      }
      const engine = await ctx.db.get(worldStatus.engineId);
      if (!engine) {
        throw new Error(`Invalid engine ID: ${worldStatus.engineId}`);
      }
      if (engine.currentTime && engine.currentTime < engineTimeout) {
        console.warn(`Restarting dead engine ${engine._id}...`);
        await kickEngine(ctx, worldStatus.worldId);
      }
    }
  },
});

export const userStatus = query({
  args: {
    worldId: v.id('worlds'),
    sessionId: v.optional(v.string()),
  },
  handler: (_ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   return null;
    // }
    // return identity.tokenIdentifier;
    if (!args.sessionId) {
      return null;
    }
    return buildSessionToken(args.sessionId);
  },
});

export const joinWorld = mutation({
  args: {
    worldId: v.id('worlds'),
    sessionId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new ConvexError(`Not logged in`);
    // }
    // const name =
    //   identity.givenName || identity.nickname || (identity.email && identity.email.split('@')[0]);
    const tokenIdentifier = buildSessionToken(args.sessionId);
    const name = sanitizePlayerName(args.name ?? DEFAULT_NAME);

    // if (!name) {
    //   throw new ConvexError(`Missing name on ${JSON.stringify(identity)}`);
    // }
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new ConvexError(`Invalid world ID: ${args.worldId}`);
    }
    // const { tokenIdentifier } = identity;
    return await insertInput(ctx, world._id, 'join', {
      name,
      character: selectSessionCharacter(args.sessionId),
      description: `${name} 是一名真人玩家，会在溪山镇、画室和小菜园里操作自己的角色。`,
      // description: `${identity.givenName} is a human player`,
      tokenIdentifier,
    });
  },
});

export const leaveWorld = mutation({
  args: {
    worldId: v.id('worlds'),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new Error(`Not logged in`);
    // }
    // const { tokenIdentifier } = identity;
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    // const existingPlayer = world.players.find((p) => p.human === tokenIdentifier);
    const tokenIdentifier = buildSessionToken(args.sessionId);
    const existingPlayer = world.players.find((p) => p.human === tokenIdentifier);
    if (!existingPlayer) {
      return;
    }
    await insertInput(ctx, world._id, 'leave', {
      playerId: existingPlayer.id,
    });
  },
});

export const addNpc = mutation({
  args: {
    worldId: v.id('worlds'),
    name: v.string(),
    character: v.string(),
    identity: v.string(),
    plan: v.string(),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    const profile = sanitizeNpcProfile(args);
    return await insertInput(ctx, world._id, 'createAgent', {
      description: profile,
    });
  },
});

export const residentStatus = query({
  args: {
    worldId: v.id('worlds'),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }

    const tokenIdentifier = buildSessionToken(args.sessionId);
    const player = world.players.find((candidate) => candidate.human === tokenIdentifier);
    const playerDescription = player
      ? await ctx.db
          .query('playerDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', player.id))
          .unique()
      : undefined;
    const worker = player ? await findArtStudioWorker(ctx.db, args.worldId, player.id) : undefined;
    const gardener = player ? await findGardener(ctx.db, args.worldId, player.id) : undefined;
    const workerStats = artStudioStatsFromWorker(worker ?? undefined);
    const gardenerStats = gardenerStatsFromRecord(gardener ?? undefined);
    const now = Date.now();
    const gardenPlots = ensureGardenPlots(gardener?.plots).map((plot) => ({
      slot: plot.slot,
      crop: plot.crop,
      phase: getGardenPlotPhase(now, plot),
      readyAt: plot.readyAt,
      cropName: plot.crop ? GARDEN_CROP_CONFIG[plot.crop].name : undefined,
    }));
    const readyPlots = gardenPlots.filter((plot) => plot.phase === 'ready').length;
    const growingPlots = gardenPlots.filter(
      (plot) => plot.phase === 'planted' || plot.phase === 'watered',
    ).length;

    return {
      joined: player !== undefined,
      player: player
        ? {
            id: player.id,
            name: playerDescription?.name ?? DEFAULT_NAME,
            character: playerDescription?.character,
            position: player.position,
            activity: player.activity,
            lastInput: player.lastInput,
          }
        : undefined,
      assets: summarizeResidentAssets(workerStats, gardenerStats),
      studio: {
        activeShift: worker?.activeShift
          ? {
              title: worker.activeShift.title,
              progress: getStudioShiftProgress(now, worker.activeShift),
              readyToFinish: now >= worker.activeShift.endsAt,
              endsAt: worker.activeShift.endsAt,
            }
          : undefined,
      },
      garden: {
        readyPlots,
        growingPlots,
        emptyPlots: gardenPlots.filter((plot) => plot.phase === 'empty').length,
        plots: gardenPlots,
      },
    };
  },
});

export const artStudioStatus = query({
  args: {
    worldId: v.id('worlds'),
    playerId: v.optional(playerId),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }

    const worker = args.playerId
      ? await findArtStudioWorker(ctx.db, args.worldId, args.playerId)
      : undefined;
    const workerStats = artStudioStatsFromWorker(worker ?? undefined);
    const now = Date.now();
    const activeShift = worker?.activeShift
      ? {
          ...worker.activeShift,
          progress: getStudioShiftProgress(now, worker.activeShift),
          readyToFinish: now >= worker.activeShift.endsAt,
        }
      : undefined;

    const workers = await ctx.db
      .query('artStudioWorkers')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const leaderboard = workers
      .sort(
        (a, b) =>
          b.florins - a.florins ||
          b.reputation - a.reputation ||
          b.shiftsCompleted - a.shiftsCompleted,
      )
      .slice(0, 5)
      .map((studioWorker) => ({
        playerId: studioWorker.playerId,
        painterName: studioWorker.painterName,
        florins: studioWorker.florins,
        paintingSkill: studioWorker.paintingSkill,
        creativity: studioWorker.creativity,
        reputation: studioWorker.reputation,
        shiftsCompleted: studioWorker.shiftsCompleted,
      }));

    return {
      studio: {
        name: '溪山画室',
        ownerName: '顾南星',
        notice: '今日招临时画工，按班次结算 Florins。',
        jobs: previewArtStudioJobs(workerStats),
      },
      worker: worker
        ? {
            playerId: worker.playerId,
            painterName: worker.painterName,
            ...workerStats,
            lastWorkedAt: worker.lastWorkedAt,
          }
        : undefined,
      activeShift,
      leaderboard,
    };
  },
});

export const startArtStudioShift = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    focus: studioFocus,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    requireHumanPlayer(world, args.playerId);

    const existingWorker = await findArtStudioWorker(ctx.db, world._id, args.playerId);
    if (existingWorker?.activeShift) {
      const progress = getStudioShiftProgress(Date.now(), existingWorker.activeShift);
      if (progress >= 1) {
        throw new Error('上一份临时工已经完成，请先领取工资。');
      }
      throw new Error('当前班次还在进行中。');
    }

    const now = Date.now();
    const painterName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);
    const stats = artStudioStatsFromWorker(existingWorker ?? undefined);
    const activeShift = createArtStudioShift(args.focus, stats, now);

    if (existingWorker) {
      await ctx.db.patch(existingWorker._id, {
        painterName,
        activeShift,
      });
    } else {
      await ctx.db.insert('artStudioWorkers', {
        worldId: world._id,
        playerId: args.playerId,
        painterName,
        ...INITIAL_STUDIO_WORKER,
        activeShift,
      });
    }
    return activeShift;
  },
});

export const finishArtStudioShift = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    requireHumanPlayer(world, args.playerId);

    const worker = await findArtStudioWorker(ctx.db, world._id, args.playerId);
    if (!worker?.activeShift) {
      throw new Error('当前没有可以结算的画室班次。');
    }

    const now = Date.now();
    if (getStudioShiftProgress(now, worker.activeShift) < 1) {
      throw new Error('这份临时工还没有做完。');
    }

    const nextStats = settleArtStudioShift(artStudioStatsFromWorker(worker), worker.activeShift);
    await ctx.db.patch(worker._id, {
      ...nextStats,
      activeShift: undefined,
      lastWorkedAt: now,
    });
    return {
      ...nextStats,
      earnedFlorins: worker.activeShift.basePay,
      skillGain: worker.activeShift.skillGain,
      creativityGain: worker.activeShift.creativityGain,
      reputationGain: worker.activeShift.reputationGain,
    };
  },
});

export const gardenStatus = query({
  args: {
    worldId: v.id('worlds'),
    playerId: v.optional(playerId),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }

    const gardener = args.playerId ? await findGardener(ctx.db, args.worldId, args.playerId) : undefined;
    const gardenerStats = gardenerStatsFromRecord(gardener ?? undefined);
    const now = Date.now();
    const plots = ensureGardenPlots(gardener?.plots).map((plot) => {
      const phase = getGardenPlotPhase(now, plot);
      const cropConfig = plot.crop ? GARDEN_CROP_CONFIG[plot.crop] : undefined;
      const growthProgress =
        plot.wateredAt && plot.readyAt
          ? Math.min(1, Math.max(0, (now - plot.wateredAt) / (plot.readyAt - plot.wateredAt)))
          : 0;
      return {
        ...plot,
        phase,
        cropName: cropConfig?.name,
        growthProgress,
        remainingMs: plot.readyAt ? Math.max(0, plot.readyAt - now) : undefined,
      };
    });

    const gardeners = await ctx.db
      .query('gardeners')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const leaderboard = gardeners
      .sort(
        (a, b) =>
          b.vegetables - a.vegetables ||
          b.coins - a.coins ||
          b.harvestsCompleted - a.harvestsCompleted,
      )
      .slice(0, 5)
      .map((entry) => ({
        playerId: entry.playerId,
        gardenerName: entry.gardenerName,
        coins: entry.coins,
        vegetables: entry.vegetables,
        gardeningSkill: entry.gardeningSkill,
        harvestsCompleted: entry.harvestsCompleted,
      }));

    return {
      garden: {
        name: '溪山小菜园',
        stewardName: '沈梨',
        notice: '空地播种，浇水后等待成熟，收获能获得菜和铜币。',
        crops: previewGardenCrops(),
      },
      gardener: gardener
        ? {
            playerId: gardener.playerId,
            gardenerName: gardener.gardenerName,
            ...gardenerStats,
            lastTendedAt: gardener.lastTendedAt,
          }
        : undefined,
      plots,
      leaderboard,
    };
  },
});

export const plantGardenCrop = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    slot: v.number(),
    crop: gardenCrop,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    requireHumanPlayer(world, args.playerId);

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    const now = Date.now();
    const plots = plantGardenPlot(ensureGardenPlots(gardener?.plots), args.slot, args.crop, now);
    const gardenerName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);

    if (gardener) {
      await ctx.db.patch(gardener._id, {
        gardenerName,
        plots,
        lastTendedAt: now,
      });
    } else {
      await ctx.db.insert('gardeners', {
        worldId: world._id,
        playerId: args.playerId,
        gardenerName,
        ...INITIAL_GARDENER_STATS,
        plots,
        lastTendedAt: now,
      });
    }
    return plots.find((plot) => plot.slot === args.slot);
  },
});

export const waterGardenCrop = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    slot: v.number(),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    requireHumanPlayer(world, args.playerId);

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    if (!gardener) {
      throw new Error('你还没有开始照看小菜园。');
    }
    const now = Date.now();
    const plots = waterGardenPlot(gardener.plots, args.slot, now);
    await ctx.db.patch(gardener._id, {
      plots,
      lastTendedAt: now,
    });
    return plots.find((plot) => plot.slot === args.slot);
  },
});

export const harvestGardenCrop = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    slot: v.number(),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    requireHumanPlayer(world, args.playerId);

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    if (!gardener) {
      throw new Error('你还没有开始照看小菜园。');
    }
    const now = Date.now();
    const outcome = harvestGardenPlot(
      gardenerStatsFromRecord(gardener),
      gardener.plots,
      args.slot,
      now,
    );
    await ctx.db.patch(gardener._id, {
      ...outcome.stats,
      plots: outcome.plots,
      lastTendedAt: now,
    });
    return outcome.harvest;
  },
});

export const sendWorldInput = mutation({
  args: {
    engineId: v.id('engines'),
    name: v.string(),
    args: v.any(),
  },
  handler: async (ctx, args) => {
    // const identity = await ctx.auth.getUserIdentity();
    // if (!identity) {
    //   throw new Error(`Not logged in`);
    // }
    return await engineInsertInput(ctx, args.engineId, args.name, args.args);
  },
});

export const worldState = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    const worldStatus = await ctx.db
      .query('worldStatus')
      .withIndex('worldId', (q) => q.eq('worldId', world._id))
      .unique();
    if (!worldStatus) {
      throw new Error(`Invalid world status ID: ${world._id}`);
    }
    const engine = await ctx.db.get(worldStatus.engineId);
    if (!engine) {
      throw new Error(`Invalid engine ID: ${worldStatus.engineId}`);
    }
    return { world, engine };
  },
});

export const gameDescriptions = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const agentDescriptions = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const worldMap = await ctx.db
      .query('maps')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .first();
    if (!worldMap) {
      throw new Error(`No map for world: ${args.worldId}`);
    }
    return { worldMap, playerDescriptions, agentDescriptions };
  },
});

export const previousConversation = query({
  args: {
    worldId: v.id('worlds'),
    playerId,
  },
  handler: async (ctx, args) => {
    // Walk the player's history in descending order, looking for a nonempty
    // conversation.
    const members = ctx.db
      .query('participatedTogether')
      .withIndex('playerHistory', (q) => q.eq('worldId', args.worldId).eq('player1', args.playerId))
      .order('desc');

    for await (const member of members) {
      const conversation = await ctx.db
        .query('archivedConversations')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('id', member.conversationId))
        .unique();
      if (!conversation) {
        throw new Error(`Invalid conversation ID: ${member.conversationId}`);
      }
      if (conversation.numMessages > 0) {
        return conversation;
      }
    }
    return null;
  },
});

export const townObservatory = query({
  args: {
    worldId: v.id('worlds'),
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }

    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const playerNames = new Map(
      playerDescriptions.map((description) => [description.playerId, description.name]),
    );
    const playerName = (id: string) => playerNames.get(id) ?? id;

    const archivedConversations = await ctx.db
      .query('archivedConversations')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const recentArchivedConversations = archivedConversations
      .sort((a, b) => b.ended - a.ended)
      .slice(0, 6);

    const conversationSummaries = await Promise.all(
      [
        ...world.conversations.map((conversation) => ({
          id: conversation.id,
          kind: 'active' as const,
          created: conversation.created,
          ended: undefined,
          numMessages: conversation.numMessages,
          participants: conversation.participants.map((participant) =>
            playerName(participant.playerId),
          ),
        })),
        ...recentArchivedConversations.map((conversation) => ({
          id: conversation.id,
          kind: 'archived' as const,
          created: conversation.created,
          ended: conversation.ended,
          numMessages: conversation.numMessages,
          participants: conversation.participants.map(playerName),
        })),
      ].map(async (conversation) => {
        const latestMessage = await ctx.db
          .query('messages')
          .withIndex('conversationId', (q) =>
            q.eq('worldId', args.worldId).eq('conversationId', conversation.id),
          )
          .order('desc')
          .first();
        return {
          ...conversation,
          latestMessage: latestMessage?.text,
          latestMessageAt: latestMessage?._creationTime,
        };
      }),
    );

    const memoryGroups = await Promise.all(
      world.agents.map(async (agent) => {
        const memories = await ctx.db
          .query('memories')
          .withIndex('playerId', (q) => q.eq('playerId', agent.playerId))
          .order('desc')
          .take(50);
        return memories.map((memory) => ({
          id: memory._id,
          owner: playerName(memory.playerId),
          description: memory.description,
          importance: memory.importance,
          type: memory.data.type,
          createdAt: memory._creationTime,
        }));
      }),
    );
    const memories = memoryGroups.flat();
    const recentMemories = memories
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
    const importantMemories = [...memories]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5);

    const participatedTogether = await ctx.db
      .query('participatedTogether')
      .withIndex('playerHistory', (q) => q.eq('worldId', args.worldId))
      .collect();
    const pairCounts = new Map<string, { players: string[]; count: number; lastEnded: number }>();
    for (const edge of participatedTogether) {
      const pair = [edge.player1, edge.player2].sort();
      const key = pair.join('|');
      const current = pairCounts.get(key);
      if (!current) {
        pairCounts.set(key, {
          players: pair.map(playerName),
          count: 1,
          lastEnded: edge.ended,
        });
      } else {
        current.count += 1;
        current.lastEnded = Math.max(current.lastEnded, edge.ended);
      }
    }
    const recurringPairs = [...pairCounts.values()]
      .map((pair) => ({ ...pair, count: Math.ceil(pair.count / 2) }))
      .sort((a, b) => b.count - a.count || b.lastEnded - a.lastEnded)
      .slice(0, 5);

    return {
      summary: {
        residents: world.players.length,
        agents: world.agents.length,
        humans: world.players.filter((player) => player.human).length,
        activeConversations: world.conversations.length,
        archivedConversations: archivedConversations.length,
        sampledMemories: memories.length,
        reflections: memories.filter((memory) => memory.type === 'reflection').length,
      },
      activeActivities: world.players
        .filter((player) => player.activity && player.activity.until > Date.now())
        .map((player) => ({
          player: playerName(player.id),
          description: player.activity!.description,
          emoji: player.activity!.emoji,
          until: player.activity!.until,
        })),
      conversations: conversationSummaries.sort(
        (a, b) => (b.latestMessageAt ?? b.ended ?? b.created) - (a.latestMessageAt ?? a.ended ?? a.created),
      ),
      recentMemories,
      importantMemories,
      recurringPairs,
    };
  },
});

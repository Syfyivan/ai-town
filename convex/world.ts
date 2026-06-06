import { ConvexError, v } from 'convex/values';
import { internalMutation, mutation, query } from './_generated/server';
import { characters, selectCharacterNameFromSeed } from '../data/characters';
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
import type { DatabaseReader, DatabaseWriter } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { Point, Vector } from './util/types';

export const NPC_NAME_MAX_LENGTH = 16;
export const NPC_IDENTITY_MAX_LENGTH = 500;
export const NPC_PLAN_MAX_LENGTH = 220;
export const ART_STUDIO_SHIFT_DURATION_MS = 60_000;
export const GARDEN_PLOT_COUNT = 4;
export const PLAYER_NAME_MAX_LENGTH = 16;
export const PLAYER_SESSION_MAX_LENGTH = 80;
export const GARDEN_MAX_ENERGY = 100;
export const GARDEN_STARTER_FOOD = 1;
export const TOWN_MONTH_DAYS = 30;
export const TOWN_MARKET_DAY = 15;
export const TAVERN_MEAL_COST = 12;
export const TAVERN_MEAL_ENERGY = 45;
export const COOKED_FOOD_ENERGY = 30;
export const VEGETABLES_PER_FOOD = 2;
export const SEED_REPLICATOR_COST = 80;
export const MARKET_SEED_BUNDLE_COST = 10;
export const MARKET_VEGETABLE_SELL_PRICE = 6;
export const SEED_SAVE_SUCCESS_RATE = 0.4;
export const SEED_REPLICATOR_SUCCESS_RATE = 0.95;
export const CAREER_WORK_START_HOUR = 10;
export const CAREER_WORK_END_HOUR = 18;
export const CAREER_ENERGY_COST = 10;
export const CAREER_SHOP_UNLOCK_XP = 100;

export type StudioFocus = 'sketch' | 'color' | 'detail';
export type GardenCropId = 'radish' | 'greens' | 'carrot';
export type SeedInventory = Record<GardenCropId, number>;
export type ProfessionId =
  | 'blacksmith'
  | 'carpenter'
  | 'farmer'
  | 'fisher'
  | 'artist'
  | 'mage'
  | 'rancher'
  | 'tavernKeeper'
  | 'seedSeller'
  | 'mayor'
  | 'scientist'
  | 'doctor';

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

export type GardenerLifeStats = {
  energy: number;
  food: number;
  seeds: SeedInventory;
  seedReplicator: boolean;
};

export type ProfessionExperience = Record<ProfessionId, number>;

export type CareerShift = {
  profession: ProfessionId;
  title: string;
  npcName: string;
  workplace: string;
  startedAt: number;
  endsAt: number;
  workDayNumber?: number;
  workDateLabel?: string;
  workHoursLabel?: string;
  payCoins: number;
  xpGain: number;
};

export type GardenPlotPhase = 'empty' | 'planted' | 'watered' | 'ready';

const studioFocus = v.union(v.literal('sketch'), v.literal('color'), v.literal('detail'));
const gardenCrop = v.union(v.literal('radish'), v.literal('greens'), v.literal('carrot'));
const profession = v.union(
  v.literal('blacksmith'),
  v.literal('carpenter'),
  v.literal('farmer'),
  v.literal('fisher'),
  v.literal('artist'),
  v.literal('mage'),
  v.literal('rancher'),
  v.literal('tavernKeeper'),
  v.literal('seedSeller'),
  v.literal('mayor'),
  v.literal('scientist'),
  v.literal('doctor'),
);

const GARDEN_STARTER_SEEDS: SeedInventory = {
  radish: 4,
  greens: 3,
  carrot: 2,
};

const GARDEN_ENERGY_COSTS = {
  plant: 4,
  water: 3,
  harvest: 6,
  saveSeeds: 5,
};

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

const INITIAL_PROFESSION_EXPERIENCE: ProfessionExperience = {
  blacksmith: 0,
  carpenter: 0,
  farmer: 0,
  fisher: 0,
  artist: 0,
  mage: 0,
  rancher: 0,
  tavernKeeper: 0,
  seedSeller: 0,
  mayor: 0,
  scientist: 0,
  doctor: 0,
};

const PROFESSION_CONFIG: Record<
  ProfessionId,
  {
    label: string;
    npcName: string;
    workplace: string;
    jobTitle: string;
    description: string;
    payCoins: number;
    xpGain: number;
  }
> = {
  blacksmith: {
    label: '铁匠',
    npcName: '铁匠宋砧',
    workplace: '溪山铁铺',
    jobTitle: '整理矿石和打磨工具',
    description: '帮铁匠分拣矿石、磨刀和修农具，适合以后做武器、工具和机械零件。',
    payCoins: 16,
    xpGain: 14,
  },
  carpenter: {
    label: '木匠',
    npcName: '木匠闻桐',
    workplace: '木作坊',
    jobTitle: '裁木板和修门窗',
    description: '跟木匠做基础木工，以后可以做家具、扩建房屋和接建造委托。',
    payCoins: 15,
    xpGain: 14,
  },
  farmer: {
    label: '农民',
    npcName: '园丁沈梨',
    workplace: '小菜园',
    jobTitle: '翻土和照看菜畦',
    description: '照看作物、学会育苗和轮作，是后续自营农场和作物交易的基础。',
    payCoins: 13,
    xpGain: 12,
  },
  fisher: {
    label: '渔夫',
    npcName: '渔夫江渚',
    workplace: '溪边码头',
    jobTitle: '修网和分拣鱼获',
    description: '在溪边帮忙修网、分鱼和记潮水，之后可以自己钓鱼、养鱼和卖水产。',
    payCoins: 14,
    xpGain: 13,
  },
  artist: {
    label: '艺术家',
    npcName: '画室顾南星',
    workplace: '溪山画室',
    jobTitle: '装裱画框和递颜料',
    description: '给画室做助手，积累审美和绘画经验，未来可以接肖像、壁画和展览。',
    payCoins: 16,
    xpGain: 15,
  },
  mage: {
    label: '魔法师',
    npcName: '法师岚珀',
    workplace: '星井小塔',
    jobTitle: '抄写符文和照看星尘',
    description: '学习基础符文、药粉和小镇异常事件处理，后续可做魔法工具和祝福。',
    payCoins: 17,
    xpGain: 15,
  },
  rancher: {
    label: '牧民',
    npcName: '牧民阿禾',
    workplace: '山坡牧棚',
    jobTitle: '喂草料和刷洗棚舍',
    description: '帮忙照顾动物，后续可以养牛羊、产奶产毛，也能做牧场订单。',
    payCoins: 14,
    xpGain: 13,
  },
  tavernKeeper: {
    label: '酒吧老板',
    npcName: '酒馆老板罗麦',
    workplace: '溪山酒馆',
    jobTitle: '备菜和招待客人',
    description: '在酒馆跑堂、备菜和听消息，未来可以经营餐饮、情报和社交活动。',
    payCoins: 18,
    xpGain: 14,
  },
  seedSeller: {
    label: '种子店老板',
    npcName: '种子商陆青',
    workplace: '种子店',
    jobTitle: '清点种子和打包订单',
    description: '学习种子库存、留种和定价，后续能经营种子、肥料和农业工具。',
    payCoins: 15,
    xpGain: 14,
  },
  mayor: {
    label: '镇长',
    npcName: '镇长许归',
    workplace: '镇公所',
    jobTitle: '整理公告和登记摊位',
    description: '处理公告、集市摊位和居民委托，为之后治理小镇和公共事件铺路。',
    payCoins: 16,
    xpGain: 13,
  },
  scientist: {
    label: '科学家',
    npcName: '科学家林序',
    workplace: '小镇实验室',
    jobTitle: '记录样本和维护仪器',
    description: '帮科学家做记录、样本和机器维护，后续可发明种子复制机等设备。',
    payCoins: 18,
    xpGain: 16,
  },
  doctor: {
    label: '医生',
    npcName: '医生白芷',
    workplace: '诊所',
    jobTitle: '整理药柜和护理病人',
    description: '在诊所做基础护理和药材整理，未来可以治疗居民、制药和处理突发疾病。',
    payCoins: 17,
    xpGain: 15,
  },
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

function clampEnergy(energy: number) {
  return Math.max(0, Math.min(GARDEN_MAX_ENERGY, Math.round(energy)));
}

function normalizeSeeds(seeds?: Partial<SeedInventory>): SeedInventory {
  return {
    radish: Math.max(0, Math.floor(seeds?.radish ?? GARDEN_STARTER_SEEDS.radish)),
    greens: Math.max(0, Math.floor(seeds?.greens ?? GARDEN_STARTER_SEEDS.greens)),
    carrot: Math.max(0, Math.floor(seeds?.carrot ?? GARDEN_STARTER_SEEDS.carrot)),
  };
}

function gardenLifeFromRecord(gardener?: Doc<'gardeners'>): GardenerLifeStats {
  return {
    energy: clampEnergy(gardener?.energy ?? GARDEN_MAX_ENERGY),
    food: Math.max(0, Math.floor(gardener?.food ?? GARDEN_STARTER_FOOD)),
    seeds: normalizeSeeds(gardener?.seeds),
    seedReplicator: gardener?.seedReplicator ?? false,
  };
}

function spendGardenEnergy(life: GardenerLifeStats, cost: number) {
  if (life.energy < cost) {
    throw new Error('能量不够了，先吃点东西或去酒馆买饭。');
  }
  return {
    ...life,
    energy: clampEnergy(life.energy - cost),
  };
}

function spendGardenSeed(seeds: SeedInventory, crop: GardenCropId) {
  if (seeds[crop] <= 0) {
    throw new Error(`没有${GARDEN_CROP_CONFIG[crop].name}种子了。`);
  }
  return {
    ...seeds,
    [crop]: seeds[crop] - 1,
  };
}

function addGardenSeeds(seeds: SeedInventory, crop: GardenCropId, amount: number) {
  return {
    ...seeds,
    [crop]: seeds[crop] + amount,
  };
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: string) {
  return hashString(seed) / 0xffffffff;
}

export function resolveSeedSaving(seed: string, hasSeedReplicator: boolean) {
  const successRate = hasSeedReplicator ? SEED_REPLICATOR_SUCCESS_RATE : SEED_SAVE_SUCCESS_RATE;
  const success = seededRandom(`${seed}:success`) < successRate;
  const seedCount = success ? 1 + Math.floor(seededRandom(`${seed}:count`) * 5) : 0;
  return { success, seedCount, successRate };
}

export function getTownCalendar(now: number, daysSlept = 0) {
  const dayNumber = Math.max(1, Math.floor(daysSlept) + 1);
  const month = Math.floor((dayNumber - 1) / TOWN_MONTH_DAYS) + 1;
  const dayOfMonth = ((dayNumber - 1) % TOWN_MONTH_DAYS) + 1;
  const date = new Date(now);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const daysUntilMarket =
    dayOfMonth <= TOWN_MARKET_DAY
      ? TOWN_MARKET_DAY - dayOfMonth
      : TOWN_MONTH_DAYS - dayOfMonth + TOWN_MARKET_DAY;
  return {
    dayNumber,
    month,
    dayOfMonth,
    hour,
    minute,
    label: `溪山历 ${month}月${dayOfMonth}日 ${String(hour).padStart(2, '0')}:${String(
      minute,
    ).padStart(2, '0')}`,
    isMarketDay: dayOfMonth === TOWN_MARKET_DAY,
    marketDay: TOWN_MARKET_DAY,
    daysUntilMarket,
  };
}

function afford(
  gardener: Doc<'gardeners'> | undefined,
  worker: Doc<'artStudioWorkers'> | undefined,
  cost: number,
) {
  if (gardener && gardener.coins >= cost) {
    return { currency: 'coins' as const, gardenerCoins: gardener.coins - cost };
  }
  if (worker && worker.florins >= cost) {
    return { currency: 'florins' as const, workerFlorins: worker.florins - cost };
  }
  throw new Error(`钱不够，需要 ${cost} 铜币或 Florins。`);
}

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
  return selectCharacterNameFromSeed(sessionId);
}

export function sanitizePlayerCharacter(character: string | undefined, sessionId: string) {
  const fallback = selectSessionCharacter(sessionId);
  if (!character) {
    return fallback;
  }
  const trimmed = character.trim();
  if (!characters.some((candidate) => candidate.name === trimmed)) {
    return fallback;
  }
  return trimmed;
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

export function getStudioShiftProgress(
  now: number,
  shift: Pick<ArtStudioShift, 'startedAt' | 'endsAt'>,
) {
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
  const growthBonus = Math.floor(
    (worker.paintingSkill + worker.creativity + worker.reputation) / 3,
  );
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

function normalizeProfessionExperience(
  experience?: Partial<ProfessionExperience>,
): ProfessionExperience {
  return {
    blacksmith: Math.max(0, Math.floor(experience?.blacksmith ?? 0)),
    carpenter: Math.max(0, Math.floor(experience?.carpenter ?? 0)),
    farmer: Math.max(0, Math.floor(experience?.farmer ?? 0)),
    fisher: Math.max(0, Math.floor(experience?.fisher ?? 0)),
    artist: Math.max(0, Math.floor(experience?.artist ?? 0)),
    mage: Math.max(0, Math.floor(experience?.mage ?? 0)),
    rancher: Math.max(0, Math.floor(experience?.rancher ?? 0)),
    tavernKeeper: Math.max(0, Math.floor(experience?.tavernKeeper ?? 0)),
    seedSeller: Math.max(0, Math.floor(experience?.seedSeller ?? 0)),
    mayor: Math.max(0, Math.floor(experience?.mayor ?? 0)),
    scientist: Math.max(0, Math.floor(experience?.scientist ?? 0)),
    doctor: Math.max(0, Math.floor(experience?.doctor ?? 0)),
  };
}

function professionLevel(experience: number) {
  return Math.floor(experience / 50) + 1;
}

function careerWorkHoursLabel() {
  return `${String(CAREER_WORK_START_HOUR).padStart(2, '0')}:00-${String(
    CAREER_WORK_END_HOUR,
  ).padStart(2, '0')}:00`;
}

export function summarizeCareerProgress(experience?: Partial<ProfessionExperience>) {
  const normalizedExperience = normalizeProfessionExperience(experience);
  return (Object.keys(PROFESSION_CONFIG) as ProfessionId[]).map((professionId) => {
    const config = PROFESSION_CONFIG[professionId];
    const xp = normalizedExperience[professionId];
    return {
      profession: professionId,
      label: config.label,
      npcName: config.npcName,
      workplace: config.workplace,
      experience: xp,
      level: professionLevel(xp),
      xpToOpenShop: Math.max(0, CAREER_SHOP_UNLOCK_XP - xp),
      canOpenShop: xp >= CAREER_SHOP_UNLOCK_XP,
    };
  });
}

export function createCareerShift(
  professionId: ProfessionId,
  now: number,
  calendar = getTownCalendar(now),
): CareerShift {
  const config = PROFESSION_CONFIG[professionId];
  return {
    profession: professionId,
    title: config.jobTitle,
    npcName: config.npcName,
    workplace: config.workplace,
    startedAt: now,
    endsAt: now,
    workDayNumber: calendar.dayNumber,
    workDateLabel: `溪山历 ${calendar.month}月${calendar.dayOfMonth}日`,
    workHoursLabel: careerWorkHoursLabel(),
    payCoins: config.payCoins,
    xpGain: config.xpGain,
  };
}

export function getCareerShiftProgress(
  now: number,
  shift: Pick<CareerShift, 'startedAt' | 'endsAt'>,
) {
  const duration = shift.endsAt - shift.startedAt;
  if (duration <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, (now - shift.startedAt) / duration));
}

export function applyCareerShiftExperience(
  experience: ProfessionExperience,
  shift: Pick<CareerShift, 'profession' | 'xpGain'>,
) {
  return {
    ...experience,
    [shift.profession]: experience[shift.profession] + shift.xpGain,
  };
}

export function previewCareerJobs(experience?: Partial<ProfessionExperience>) {
  const progressByProfession = new Map(
    summarizeCareerProgress(experience).map((entry) => [entry.profession, entry]),
  );
  return (Object.keys(PROFESSION_CONFIG) as ProfessionId[]).map((professionId) => {
    const config = PROFESSION_CONFIG[professionId];
    const progress = progressByProfession.get(professionId)!;
    return {
      profession: professionId,
      label: config.label,
      npcName: config.npcName,
      workplace: config.workplace,
      title: config.jobTitle,
      description: config.description,
      payCoins: config.payCoins,
      xpGain: config.xpGain,
      workHoursLabel: careerWorkHoursLabel(),
      level: progress.level,
      experience: progress.experience,
      xpToOpenShop: progress.xpToOpenShop,
      canOpenShop: progress.canOpenShop,
    };
  });
}

export function summarizeResidentAssets(
  worker?: StudioWorkerStats,
  gardener?: GardenerStats & Partial<GardenerLifeStats>,
) {
  const seeds = normalizeSeeds(gardener?.seeds);
  return {
    florins: worker?.florins ?? 0,
    coins: gardener?.coins ?? 0,
    vegetables: gardener?.vegetables ?? 0,
    energy: clampEnergy(gardener?.energy ?? GARDEN_MAX_ENERGY),
    maxEnergy: GARDEN_MAX_ENERGY,
    food: Math.max(0, Math.floor(gardener?.food ?? GARDEN_STARTER_FOOD)),
    seeds,
    totalSeeds: seeds.radish + seeds.greens + seeds.carrot,
    seedReplicator: gardener?.seedReplicator ?? false,
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

function fullGardenerStatsFromRecord(
  gardener?: Doc<'gardeners'>,
): GardenerStats & GardenerLifeStats {
  return {
    ...gardenerStatsFromRecord(gardener),
    ...gardenLifeFromRecord(gardener),
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

async function findCareerProfile(
  db: DatabaseReader,
  worldId: Id<'worlds'>,
  careerPlayerId: string,
) {
  return await db
    .query('careerProfiles')
    .withIndex('worldPlayer', (q) => q.eq('worldId', worldId).eq('playerId', careerPlayerId))
    .unique();
}

async function findResidentProfile(
  db: DatabaseReader,
  worldId: Id<'worlds'>,
  tokenIdentifier: string,
) {
  return await db
    .query('residentProfiles')
    .withIndex('worldToken', (q) => q.eq('worldId', worldId).eq('tokenIdentifier', tokenIdentifier))
    .unique();
}

async function upsertResidentProfile(
  db: DatabaseWriter,
  worldId: Id<'worlds'>,
  tokenIdentifier: string,
  sessionId: string,
  name: string,
  character: string,
  updates: {
    savedPosition?: Point;
    savedFacing?: Vector;
    lastSavedAt?: number;
    daysSlept?: number;
  } = {},
) {
  const now = Date.now();
  const existing = await findResidentProfile(db, worldId, tokenIdentifier);
  if (existing) {
    const next = {
      ...existing,
      sessionId,
      name,
      character,
      updatedAt: now,
    };
    if (updates.savedPosition !== undefined) {
      next.savedPosition = updates.savedPosition;
    }
    if (updates.savedFacing !== undefined) {
      next.savedFacing = updates.savedFacing;
    }
    if (updates.lastSavedAt !== undefined) {
      next.lastSavedAt = updates.lastSavedAt;
    }
    if (updates.daysSlept !== undefined) {
      next.daysSlept = updates.daysSlept;
    }
    await db.replace(existing._id, next);
    return next;
  }

  const profile = {
    worldId,
    tokenIdentifier,
    sessionId,
    name,
    character,
    savedPosition: updates.savedPosition,
    savedFacing: updates.savedFacing,
    lastSavedAt: updates.lastSavedAt,
    daysSlept: updates.daysSlept ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert('residentProfiles', profile);
  return profile;
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

function createMailboxLetters(
  world: Doc<'worlds'>,
  playerDescriptions: Array<Doc<'playerDescriptions'>>,
  dayNumber: number,
) {
  const names = new Map(
    playerDescriptions.map((description) => [description.playerId, description.name]),
  );
  const descriptions = new Map(
    playerDescriptions.map((description) => [description.playerId, description.description]),
  );
  const npcPlayers = world.players
    .filter((player) => !player.human)
    .map((player) => ({
      playerId: player.id,
      name: names.get(player.id) ?? player.id,
      description: descriptions.get(player.id) ?? '溪山镇的居民',
    }))
    .filter((player) => player.name !== player.playerId);

  if (npcPlayers.length < 2) {
    return [];
  }

  return npcPlayers.slice(0, Math.min(4, npcPlayers.length)).map((sender, index) => {
    const recipient = npcPlayers[(index + dayNumber) % npcPlayers.length];
    const topic =
      index % 3 === 0
        ? '今天集市的摊位要不要一起准备'
        : index % 3 === 1
          ? '门口信箱里新来的种子目录'
          : '傍晚去酒馆听到的小镇传闻';
    return {
      id: `${dayNumber}-${sender.playerId}-${recipient.playerId}`,
      from: sender.name,
      to: recipient.name,
      subject: topic,
      text: `${sender.name} 写给 ${recipient.name}：${topic}。${sender.description.slice(0, 42)}`,
      dayNumber,
    };
  });
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
    character: v.optional(v.string()),
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
    const character = sanitizePlayerCharacter(args.character, args.sessionId);

    // if (!name) {
    //   throw new ConvexError(`Missing name on ${JSON.stringify(identity)}`);
    // }
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new ConvexError(`Invalid world ID: ${args.worldId}`);
    }
    const profile = await findResidentProfile(ctx.db, world._id, tokenIdentifier);
    await upsertResidentProfile(
      ctx.db,
      world._id,
      tokenIdentifier,
      args.sessionId,
      name,
      character,
    );
    // const { tokenIdentifier } = identity;
    return await insertInput(ctx, world._id, 'join', {
      name,
      character,
      description: `${name} 是一名真人玩家，会在溪山镇、画室和小菜园里操作自己的角色。`,
      // description: `${identity.givenName} is a human player`,
      tokenIdentifier,
      spawnPosition: profile?.savedPosition,
      spawnFacing: profile?.savedFacing,
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
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', world._id).eq('playerId', existingPlayer.id))
      .unique();
    await upsertResidentProfile(
      ctx.db,
      world._id,
      tokenIdentifier,
      args.sessionId,
      playerDescription?.name ?? DEFAULT_NAME,
      sanitizePlayerCharacter(playerDescription?.character, args.sessionId),
      {
        savedPosition: existingPlayer.position,
        savedFacing: existingPlayer.facing,
      },
    );
    await insertInput(ctx, world._id, 'leave', {
      playerId: existingPlayer.id,
    });
  },
});

export const sleepAndSaveResident = mutation({
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
    if (!player) {
      throw new Error('先点击「互动」进入小镇，再睡觉存档。');
    }
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', world._id).eq('playerId', player.id))
      .unique();
    const existingProfile = await findResidentProfile(ctx.db, world._id, tokenIdentifier);
    const now = Date.now();
    await upsertResidentProfile(
      ctx.db,
      world._id,
      tokenIdentifier,
      args.sessionId,
      playerDescription?.name ?? DEFAULT_NAME,
      sanitizePlayerCharacter(playerDescription?.character, args.sessionId),
      {
        savedPosition: player.position,
        savedFacing: player.facing,
        lastSavedAt: now,
        daysSlept: (existingProfile?.daysSlept ?? 0) + 1,
      },
    );
    return await insertInput(ctx, world._id, 'sleep', {
      playerId: player.id,
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
    const profile = await findResidentProfile(ctx.db, args.worldId, tokenIdentifier);
    const player = world.players.find((candidate) => candidate.human === tokenIdentifier);
    const playerDescription = player
      ? await ctx.db
          .query('playerDescriptions')
          .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', player.id))
          .unique()
      : undefined;
    const worker = player ? await findArtStudioWorker(ctx.db, args.worldId, player.id) : undefined;
    const gardener = player ? await findGardener(ctx.db, args.worldId, player.id) : undefined;
    const careerProfile = player
      ? await findCareerProfile(ctx.db, args.worldId, player.id)
      : undefined;
    const workerStats = artStudioStatsFromWorker(worker ?? undefined);
    const gardenerStats = fullGardenerStatsFromRecord(gardener ?? undefined);
    const careerExperience = normalizeProfessionExperience(careerProfile?.experience);
    const now = Date.now();
    const calendar = getTownCalendar(now, profile?.daysSlept ?? 0);
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
    const playerDescriptions = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId))
      .collect();
    const mailboxLetters = createMailboxLetters(world, playerDescriptions, calendar.dayNumber);

    return {
      joined: player !== undefined,
      calendar,
      mailbox: {
        mailboxes: Math.max(0, world.players.filter((candidate) => !candidate.human).length),
        letters: mailboxLetters,
      },
      market: {
        isOpen: calendar.isMarketDay,
        dayOfMonth: TOWN_MARKET_DAY,
        daysUntilMarket: calendar.daysUntilMarket,
        sellPrice: MARKET_VEGETABLE_SELL_PRICE,
        seedBundleCost: MARKET_SEED_BUNDLE_COST,
      },
      profile: {
        name: profile?.name ?? DEFAULT_NAME,
        character: profile?.character ?? selectSessionCharacter(args.sessionId),
        savedPosition: profile?.savedPosition,
        lastSavedAt: profile?.lastSavedAt,
        daysSlept: profile?.daysSlept ?? 0,
      },
      player: player
        ? {
            id: player.id,
            name: playerDescription?.name ?? DEFAULT_NAME,
            character: playerDescription?.character ?? profile?.character,
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
      career: {
        totalJobs: careerProfile?.totalJobs ?? 0,
        totalCoinsEarned: careerProfile?.totalCoinsEarned ?? 0,
        shopUnlockXp: CAREER_SHOP_UNLOCK_XP,
        energyCost: CAREER_ENERGY_COST,
        workHoursLabel: careerWorkHoursLabel(),
        workedToday: careerProfile?.lastWorkDayNumber === calendar.dayNumber,
        lastWorkDayNumber: careerProfile?.lastWorkDayNumber,
        lastWorkDateLabel: careerProfile?.lastWorkDateLabel,
        lastWorkedProfession: careerProfile?.lastWorkedProfession,
        lastWorkedProfessionLabel: careerProfile?.lastWorkedProfession
          ? PROFESSION_CONFIG[careerProfile.lastWorkedProfession].label
          : undefined,
        activeJob: careerProfile?.activeJob
          ? {
              ...careerProfile.activeJob,
              progress: getCareerShiftProgress(now, careerProfile.activeJob),
              readyToFinish: now >= careerProfile.activeJob.endsAt,
            }
          : undefined,
        jobs: previewCareerJobs(careerExperience),
        progress: summarizeCareerProgress(careerExperience),
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

export const workCareerDay = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    profession,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    const player = requireHumanPlayer(world, args.playerId);

    const now = Date.now();
    const residentProfile = player.human
      ? await findResidentProfile(ctx.db, world._id, player.human)
      : undefined;
    const calendar = getTownCalendar(now, residentProfile?.daysSlept ?? 0);
    const careerProfile = await findCareerProfile(ctx.db, world._id, args.playerId);
    if (careerProfile?.lastWorkDayNumber === calendar.dayNumber) {
      throw new Error('今天已经做过一天临时工了，睡一觉明天再去。');
    }
    if (careerProfile?.activeJob) {
      throw new Error('还有一份旧临时工记录，请先领取工资再做今天的工。');
    }

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    const life = spendGardenEnergy(gardenLifeFromRecord(gardener ?? undefined), CAREER_ENERGY_COST);
    const residentName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);
    const dayWork = createCareerShift(args.profession, now, calendar);
    const experience = normalizeProfessionExperience(careerProfile?.experience);
    const nextExperience = applyCareerShiftExperience(experience, dayWork);
    const nextCoins = (gardener?.coins ?? INITIAL_GARDENER_STATS.coins) + dayWork.payCoins;

    if (gardener) {
      await ctx.db.patch(gardener._id, {
        gardenerName: residentName,
        coins: nextCoins,
        energy: life.energy,
        food: life.food,
        seeds: life.seeds,
        seedReplicator: life.seedReplicator,
        lastTendedAt: now,
      });
    } else {
      await ctx.db.insert('gardeners', {
        worldId: world._id,
        playerId: args.playerId,
        gardenerName: residentName,
        ...INITIAL_GARDENER_STATS,
        coins: nextCoins,
        energy: life.energy,
        food: life.food,
        seeds: life.seeds,
        seedReplicator: life.seedReplicator,
        plots: createGardenPlots(),
        lastTendedAt: now,
      });
    }

    if (careerProfile) {
      await ctx.db.patch(careerProfile._id, {
        residentName,
        experience: nextExperience,
        totalJobs: careerProfile.totalJobs + 1,
        totalCoinsEarned: careerProfile.totalCoinsEarned + dayWork.payCoins,
        lastWorkDayNumber: calendar.dayNumber,
        lastWorkDateLabel: dayWork.workDateLabel,
        lastWorkedProfession: args.profession,
        lastWorkedAt: now,
      });
    } else {
      await ctx.db.insert('careerProfiles', {
        worldId: world._id,
        playerId: args.playerId,
        residentName,
        experience: nextExperience,
        totalJobs: 1,
        totalCoinsEarned: dayWork.payCoins,
        lastWorkDayNumber: calendar.dayNumber,
        lastWorkDateLabel: dayWork.workDateLabel,
        lastWorkedProfession: args.profession,
        lastWorkedAt: now,
      });
    }

    const progress = summarizeCareerProgress(nextExperience).find(
      (entry) => entry.profession === args.profession,
    )!;
    return {
      ...dayWork,
      label: PROFESSION_CONFIG[args.profession].label,
      experience: progress.experience,
      level: progress.level,
      canOpenShop: progress.canOpenShop,
      totalJobs: (careerProfile?.totalJobs ?? 0) + 1,
      totalCoinsEarned: (careerProfile?.totalCoinsEarned ?? 0) + dayWork.payCoins,
      coins: nextCoins,
      energy: life.energy,
    };
  },
});

export const startCareerShift = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    profession,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    const player = requireHumanPlayer(world, args.playerId);

    const careerProfile = await findCareerProfile(ctx.db, world._id, args.playerId);
    if (careerProfile?.activeJob) {
      const progress = getCareerShiftProgress(Date.now(), careerProfile.activeJob);
      if (progress >= 1) {
        throw new Error('上一份临时工已经完成，请先领取工资。');
      }
      throw new Error('当前还有临时工正在进行。');
    }

    const now = Date.now();
    const residentProfile = player.human
      ? await findResidentProfile(ctx.db, world._id, player.human)
      : undefined;
    const calendar = getTownCalendar(now, residentProfile?.daysSlept ?? 0);
    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    const life = spendGardenEnergy(gardenLifeFromRecord(gardener ?? undefined), CAREER_ENERGY_COST);
    const residentName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);
    const activeJob = createCareerShift(args.profession, now, calendar);

    if (gardener) {
      await ctx.db.patch(gardener._id, {
        gardenerName: residentName,
        energy: life.energy,
        food: life.food,
        seeds: life.seeds,
        seedReplicator: life.seedReplicator,
        lastTendedAt: now,
      });
    } else {
      await ctx.db.insert('gardeners', {
        worldId: world._id,
        playerId: args.playerId,
        gardenerName: residentName,
        ...INITIAL_GARDENER_STATS,
        energy: life.energy,
        food: life.food,
        seeds: life.seeds,
        seedReplicator: life.seedReplicator,
        plots: createGardenPlots(),
        lastTendedAt: now,
      });
    }

    if (careerProfile) {
      await ctx.db.patch(careerProfile._id, {
        residentName,
        experience: normalizeProfessionExperience(careerProfile.experience),
        activeJob,
      });
    } else {
      await ctx.db.insert('careerProfiles', {
        worldId: world._id,
        playerId: args.playerId,
        residentName,
        experience: normalizeProfessionExperience(INITIAL_PROFESSION_EXPERIENCE),
        totalJobs: 0,
        totalCoinsEarned: 0,
        activeJob,
      });
    }
    return activeJob;
  },
});

export const finishCareerShift = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    const player = requireHumanPlayer(world, args.playerId);

    const careerProfile = await findCareerProfile(ctx.db, world._id, args.playerId);
    if (!careerProfile?.activeJob) {
      throw new Error('当前没有可以结算的临时工。');
    }

    const now = Date.now();
    if (getCareerShiftProgress(now, careerProfile.activeJob) < 1) {
      throw new Error('这份临时工还没有做完。');
    }
    const residentProfile = player.human
      ? await findResidentProfile(ctx.db, world._id, player.human)
      : undefined;
    const calendar = getTownCalendar(now, residentProfile?.daysSlept ?? 0);
    const workDateLabel =
      careerProfile.activeJob.workDateLabel ?? `溪山历 ${calendar.month}月${calendar.dayOfMonth}日`;

    const experience = normalizeProfessionExperience(careerProfile.experience);
    const nextExperience = applyCareerShiftExperience(experience, careerProfile.activeJob);
    await ctx.db.patch(careerProfile._id, {
      experience: nextExperience,
      totalJobs: careerProfile.totalJobs + 1,
      totalCoinsEarned: careerProfile.totalCoinsEarned + careerProfile.activeJob.payCoins,
      activeJob: undefined,
      lastWorkDayNumber: careerProfile.activeJob.workDayNumber ?? calendar.dayNumber,
      lastWorkDateLabel: workDateLabel,
      lastWorkedProfession: careerProfile.activeJob.profession,
      lastWorkedAt: now,
    });

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    const residentName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);
    if (gardener) {
      await ctx.db.patch(gardener._id, {
        gardenerName: residentName,
        coins: gardener.coins + careerProfile.activeJob.payCoins,
        lastTendedAt: now,
      });
    } else {
      const life = gardenLifeFromRecord(undefined);
      await ctx.db.insert('gardeners', {
        worldId: world._id,
        playerId: args.playerId,
        gardenerName: residentName,
        ...INITIAL_GARDENER_STATS,
        coins: careerProfile.activeJob.payCoins,
        energy: life.energy,
        food: life.food,
        seeds: life.seeds,
        seedReplicator: life.seedReplicator,
        plots: createGardenPlots(),
        lastTendedAt: now,
      });
    }

    const progress = summarizeCareerProgress(nextExperience).find(
      (entry) => entry.profession === careerProfile.activeJob!.profession,
    )!;
    return {
      profession: careerProfile.activeJob.profession,
      label: PROFESSION_CONFIG[careerProfile.activeJob.profession].label,
      title: careerProfile.activeJob.title,
      payCoins: careerProfile.activeJob.payCoins,
      xpGain: careerProfile.activeJob.xpGain,
      experience: progress.experience,
      level: progress.level,
      canOpenShop: progress.canOpenShop,
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

    const gardener = args.playerId
      ? await findGardener(ctx.db, args.worldId, args.playerId)
      : undefined;
    const gardenerStats = fullGardenerStatsFromRecord(gardener ?? undefined);
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
    const gardenerSummary = args.playerId
      ? {
          playerId: args.playerId,
          gardenerName: '新来的园丁',
          ...gardenerStats,
        }
      : undefined;

    return {
      garden: {
        name: '溪山小菜园',
        stewardName: '沈梨',
        notice: '开局送种子；成熟作物可以收获，也可以留种。',
        crops: previewGardenCrops().map((crop) => ({
          ...crop,
          seedsAvailable: gardenerStats.seeds[crop.crop],
        })),
        seedSaving: {
          baseSuccessRate: SEED_SAVE_SUCCESS_RATE,
          replicatorSuccessRate: SEED_REPLICATOR_SUCCESS_RATE,
          seedReplicatorCost: SEED_REPLICATOR_COST,
        },
      },
      gardener: gardener
        ? {
            playerId: gardener.playerId,
            gardenerName: gardener.gardenerName,
            ...gardenerStats,
            lastTendedAt: gardener.lastTendedAt,
          }
        : gardenerSummary,
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
    const life = spendGardenEnergy(
      gardenLifeFromRecord(gardener ?? undefined),
      GARDEN_ENERGY_COSTS.plant,
    );
    const seeds = spendGardenSeed(life.seeds, args.crop);
    const plots = plantGardenPlot(ensureGardenPlots(gardener?.plots), args.slot, args.crop, now);
    const gardenerName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);

    if (gardener) {
      await ctx.db.patch(gardener._id, {
        gardenerName,
        plots,
        energy: life.energy,
        food: life.food,
        seeds,
        seedReplicator: life.seedReplicator,
        lastTendedAt: now,
      });
    } else {
      await ctx.db.insert('gardeners', {
        worldId: world._id,
        playerId: args.playerId,
        gardenerName,
        ...INITIAL_GARDENER_STATS,
        energy: life.energy,
        food: life.food,
        seeds,
        seedReplicator: life.seedReplicator,
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
    const life = spendGardenEnergy(gardenLifeFromRecord(gardener), GARDEN_ENERGY_COSTS.water);
    const plots = waterGardenPlot(gardener.plots, args.slot, now);
    await ctx.db.patch(gardener._id, {
      plots,
      energy: life.energy,
      food: life.food,
      seeds: life.seeds,
      seedReplicator: life.seedReplicator,
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
    const life = spendGardenEnergy(gardenLifeFromRecord(gardener), GARDEN_ENERGY_COSTS.harvest);
    const outcome = harvestGardenPlot(
      gardenerStatsFromRecord(gardener),
      gardener.plots,
      args.slot,
      now,
    );
    await ctx.db.patch(gardener._id, {
      ...outcome.stats,
      energy: life.energy,
      food: life.food,
      seeds: life.seeds,
      seedReplicator: life.seedReplicator,
      plots: outcome.plots,
      lastTendedAt: now,
    });
    return outcome.harvest;
  },
});

export const saveGardenSeeds = mutation({
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
    const normalizedPlots = ensureGardenPlots(gardener.plots);
    const plot = findGardenPlot(normalizedPlots, args.slot);
    if (getGardenPlotPhase(now, plot) !== 'ready') {
      throw new Error('只有成熟作物可以留种。');
    }
    const crop = plot.crop!;
    const life = spendGardenEnergy(gardenLifeFromRecord(gardener), GARDEN_ENERGY_COSTS.saveSeeds);
    const saving = resolveSeedSaving(
      `${world._id}:${args.playerId}:${args.slot}:${gardener.harvestsCompleted}:${now}`,
      life.seedReplicator,
    );
    const seeds = saving.success ? addGardenSeeds(life.seeds, crop, saving.seedCount) : life.seeds;
    await ctx.db.patch(gardener._id, {
      energy: life.energy,
      food: life.food,
      seeds,
      seedReplicator: life.seedReplicator,
      plots: replaceGardenPlot(normalizedPlots, { slot: args.slot }),
      lastTendedAt: now,
    });
    return {
      crop,
      cropName: GARDEN_CROP_CONFIG[crop].name,
      ...saving,
    };
  },
});

export const buyTavernMeal = mutation({
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

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    const worker = await findArtStudioWorker(ctx.db, world._id, args.playerId);
    const payment = afford(gardener ?? undefined, worker ?? undefined, TAVERN_MEAL_COST);
    const life = gardenLifeFromRecord(gardener ?? undefined);
    const gardenerName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);
    if (payment.workerFlorins !== undefined && worker) {
      await ctx.db.patch(worker._id, { florins: payment.workerFlorins });
    }
    const nextEnergy = clampEnergy(life.energy + TAVERN_MEAL_ENERGY);
    const commonPatch = {
      energy: nextEnergy,
      food: life.food,
      seeds: life.seeds,
      seedReplicator: life.seedReplicator,
      lastTendedAt: Date.now(),
    };
    if (gardener) {
      await ctx.db.patch(gardener._id, {
        ...commonPatch,
        gardenerName,
        coins: payment.gardenerCoins ?? gardener.coins,
      });
    } else {
      await ctx.db.insert('gardeners', {
        worldId: world._id,
        playerId: args.playerId,
        gardenerName,
        ...INITIAL_GARDENER_STATS,
        ...commonPatch,
        plots: createGardenPlots(),
      });
    }
    return {
      paidWith: payment.currency,
      cost: TAVERN_MEAL_COST,
      energy: nextEnergy,
      energyGain: TAVERN_MEAL_ENERGY,
    };
  },
});

export const cookGardenFood = mutation({
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

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    if (!gardener) {
      throw new Error('你还没有蔬菜可以做饭。');
    }
    if (gardener.vegetables < VEGETABLES_PER_FOOD) {
      throw new Error(`做饭需要 ${VEGETABLES_PER_FOOD} 份蔬菜。`);
    }
    const life = gardenLifeFromRecord(gardener);
    await ctx.db.patch(gardener._id, {
      vegetables: gardener.vegetables - VEGETABLES_PER_FOOD,
      food: life.food + 1,
      energy: life.energy,
      seeds: life.seeds,
      seedReplicator: life.seedReplicator,
      lastTendedAt: Date.now(),
    });
    return {
      food: life.food + 1,
      vegetablesSpent: VEGETABLES_PER_FOOD,
    };
  },
});

export const eatGardenFood = mutation({
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

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    if (!gardener) {
      throw new Error('背包里还没有吃的。');
    }
    const life = gardenLifeFromRecord(gardener);
    if (life.food <= 0) {
      throw new Error('背包里还没有吃的。');
    }
    const nextEnergy = clampEnergy(life.energy + COOKED_FOOD_ENERGY);
    await ctx.db.patch(gardener._id, {
      food: life.food - 1,
      energy: nextEnergy,
      seeds: life.seeds,
      seedReplicator: life.seedReplicator,
      lastTendedAt: Date.now(),
    });
    return {
      food: life.food - 1,
      energy: nextEnergy,
      energyGain: COOKED_FOOD_ENERGY,
    };
  },
});

export const buySeedReplicator = mutation({
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

    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    const worker = await findArtStudioWorker(ctx.db, world._id, args.playerId);
    const life = gardenLifeFromRecord(gardener ?? undefined);
    if (life.seedReplicator) {
      return { alreadyOwned: true, successRate: SEED_REPLICATOR_SUCCESS_RATE };
    }
    const payment = afford(gardener ?? undefined, worker ?? undefined, SEED_REPLICATOR_COST);
    const gardenerName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);
    if (payment.workerFlorins !== undefined && worker) {
      await ctx.db.patch(worker._id, { florins: payment.workerFlorins });
    }
    const commonPatch = {
      energy: life.energy,
      food: life.food,
      seeds: life.seeds,
      seedReplicator: true,
      lastTendedAt: Date.now(),
    };
    if (gardener) {
      await ctx.db.patch(gardener._id, {
        ...commonPatch,
        gardenerName,
        coins: payment.gardenerCoins ?? gardener.coins,
      });
    } else {
      await ctx.db.insert('gardeners', {
        worldId: world._id,
        playerId: args.playerId,
        gardenerName,
        ...INITIAL_GARDENER_STATS,
        ...commonPatch,
        plots: createGardenPlots(),
      });
    }
    return {
      alreadyOwned: false,
      paidWith: payment.currency,
      cost: SEED_REPLICATOR_COST,
      successRate: SEED_REPLICATOR_SUCCESS_RATE,
    };
  },
});

async function requireMarketOpen(db: DatabaseReader, world: Doc<'worlds'>, marketPlayerId: string) {
  const player = requireHumanPlayer(world, marketPlayerId);
  const profile = player.human ? await findResidentProfile(db, world._id, player.human) : undefined;
  const calendar = getTownCalendar(Date.now(), profile?.daysSlept ?? 0);
  if (!calendar.isMarketDay) {
    throw new Error(`今天不是集市日，下次集市还有 ${calendar.daysUntilMarket} 天。`);
  }
  return calendar;
}

export const marketBuySeedBundle = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
    crop: gardenCrop,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    await requireMarketOpen(ctx.db, world, args.playerId);
    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    const worker = await findArtStudioWorker(ctx.db, world._id, args.playerId);
    const payment = afford(gardener ?? undefined, worker ?? undefined, MARKET_SEED_BUNDLE_COST);
    const life = gardenLifeFromRecord(gardener ?? undefined);
    const gardenerName = await getPlayerDisplayName(ctx.db, world._id, args.playerId);
    if (payment.workerFlorins !== undefined && worker) {
      await ctx.db.patch(worker._id, { florins: payment.workerFlorins });
    }
    const seeds = addGardenSeeds(life.seeds, args.crop, 3);
    const commonPatch = {
      energy: life.energy,
      food: life.food,
      seeds,
      seedReplicator: life.seedReplicator,
      lastTendedAt: Date.now(),
    };
    if (gardener) {
      await ctx.db.patch(gardener._id, {
        ...commonPatch,
        gardenerName,
        coins: payment.gardenerCoins ?? gardener.coins,
      });
    } else {
      await ctx.db.insert('gardeners', {
        worldId: world._id,
        playerId: args.playerId,
        gardenerName,
        ...INITIAL_GARDENER_STATS,
        ...commonPatch,
        plots: createGardenPlots(),
      });
    }
    return {
      crop: args.crop,
      cropName: GARDEN_CROP_CONFIG[args.crop].name,
      seedsAdded: 3,
      paidWith: payment.currency,
      cost: MARKET_SEED_BUNDLE_COST,
    };
  },
});

export const marketSellVegetable = mutation({
  args: {
    worldId: v.id('worlds'),
    playerId,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`Invalid world ID: ${args.worldId}`);
    }
    await requireMarketOpen(ctx.db, world, args.playerId);
    const gardener = await findGardener(ctx.db, world._id, args.playerId);
    if (!gardener || gardener.vegetables <= 0) {
      throw new Error('没有可以摆摊出售的蔬菜。');
    }
    const life = gardenLifeFromRecord(gardener);
    await ctx.db.patch(gardener._id, {
      vegetables: gardener.vegetables - 1,
      coins: gardener.coins + MARKET_VEGETABLE_SELL_PRICE,
      energy: life.energy,
      food: life.food,
      seeds: life.seeds,
      seedReplicator: life.seedReplicator,
      lastTendedAt: Date.now(),
    });
    return {
      vegetables: gardener.vegetables - 1,
      coins: gardener.coins + MARKET_VEGETABLE_SELL_PRICE,
      earnedCoins: MARKET_VEGETABLE_SELL_PRICE,
    };
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
    const recentMemories = memories.sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
    const importantMemories = [...memories].sort((a, b) => b.importance - a.importance).slice(0, 5);

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
        (a, b) =>
          (b.latestMessageAt ?? b.ended ?? b.created) - (a.latestMessageAt ?? a.ended ?? a.created),
      ),
      recentMemories,
      importantMemories,
      recurringPairs,
    };
  },
});

import { useConvex, useMutation, useQuery } from 'convex/react';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { characterAppearanceOptions } from '../../data/characters';
import { waitForInput } from '../hooks/sendInput';
import { usePlayerSettings } from '../hooks/usePlayerSettings';
import { useSessionIdentity } from '../hooks/useSessionIdentity';
import AvatarPreview from './AvatarPreview';
import type { ProfessionId } from './professionCatalog';

type GardenCropId = 'radish' | 'greens' | 'carrot';

const FALLBACK_CAREER_BASE: Array<{
  profession: ProfessionId;
  label: string;
  skillName: string;
  npcName: string;
  workplace: string;
  title: string;
  description: string;
  payCoins: number;
  xpGain: number;
}> = [
  {
    profession: 'blacksmith',
    label: '铁匠',
    skillName: '锻打等级',
    npcName: '铁匠宋砧',
    workplace: '溪山铁铺',
    title: '整理矿石和打磨工具',
    description: '帮铁匠分拣矿石、磨刀和修农具。',
    payCoins: 16,
    xpGain: 14,
  },
  {
    profession: 'carpenter',
    label: '木匠',
    skillName: '木工等级',
    npcName: '木匠闻桐',
    workplace: '木作坊',
    title: '裁木板和修门窗',
    description: '跟木匠做基础木工，之后可以做家具和扩建。',
    payCoins: 15,
    xpGain: 14,
  },
  {
    profession: 'farmer',
    label: '农民',
    skillName: '园艺等级',
    npcName: '园丁沈梨',
    workplace: '小菜园',
    title: '翻土和照看菜畦',
    description: '照看作物、育苗和轮作，是自营农场的基础。',
    payCoins: 13,
    xpGain: 12,
  },
  {
    profession: 'fisher',
    label: '渔夫',
    skillName: '垂钓等级',
    npcName: '渔夫江渚',
    workplace: '溪边码头',
    title: '修网和分拣鱼获',
    description: '在溪边修网、分鱼和记录潮水。',
    payCoins: 14,
    xpGain: 13,
  },
  {
    profession: 'artist',
    label: '艺术家',
    skillName: '绘画等级',
    npcName: '画室顾南星',
    workplace: '溪山画室',
    title: '装裱画框和递颜料',
    description: '给画室做助手，积累绘画和审美经验。',
    payCoins: 16,
    xpGain: 15,
  },
  {
    profession: 'mage',
    label: '魔法师',
    skillName: '魔法等级',
    npcName: '法师岚珀',
    workplace: '星井小塔',
    title: '抄写符文和照看星尘',
    description: '学习基础符文和小镇异常事件处理。',
    payCoins: 17,
    xpGain: 15,
  },
  {
    profession: 'rancher',
    label: '牧民',
    skillName: '牧养等级',
    npcName: '牧民阿禾',
    workplace: '山坡牧棚',
    title: '喂草料和刷洗棚舍',
    description: '照顾动物，为后续牧场经营做准备。',
    payCoins: 14,
    xpGain: 13,
  },
  {
    profession: 'tavernKeeper',
    label: '酒吧老板',
    skillName: '烹饪等级',
    npcName: '酒馆老板罗麦',
    workplace: '溪山酒馆',
    title: '备菜和招待客人',
    description: '在酒馆跑堂、备菜和听镇上消息。',
    payCoins: 18,
    xpGain: 14,
  },
  {
    profession: 'seedSeller',
    label: '种子店老板',
    skillName: '育种等级',
    npcName: '种子商陆青',
    workplace: '种子店',
    title: '清点种子和打包订单',
    description: '学习种子库存、留种和定价。',
    payCoins: 15,
    xpGain: 14,
  },
  {
    profession: 'mayor',
    label: '镇长',
    skillName: '行政等级',
    npcName: '镇长许归',
    workplace: '镇公所',
    title: '整理公告和登记摊位',
    description: '处理公告、集市摊位和居民委托。',
    payCoins: 16,
    xpGain: 13,
  },
  {
    profession: 'scientist',
    label: '科学家',
    skillName: '科研等级',
    npcName: '科学家林序',
    workplace: '小镇实验室',
    title: '记录样本和维护仪器',
    description: '帮科学家做样本记录和机器维护。',
    payCoins: 18,
    xpGain: 16,
  },
  {
    profession: 'doctor',
    label: '医生',
    skillName: '医术等级',
    npcName: '医生白芷',
    workplace: '诊所',
    title: '整理药柜和护理病人',
    description: '在诊所做基础护理和药材整理。',
    payCoins: 17,
    xpGain: 15,
  },
];

const FALLBACK_CAREER_JOBS = FALLBACK_CAREER_BASE.map((job) => ({
  ...job,
  workHoursLabel: '10:00-18:00',
  level: 1,
  maxLevel: 10,
  experience: 0,
  xpToOpenShop: 100,
  canOpenShop: false,
  currentUnlock: '基础帮工',
  nextUnlock: '二级制品',
  nextLevelXp: 50,
}));

const FALLBACK_CAREER_PROGRESS = FALLBACK_CAREER_BASE.map((job) => ({
  profession: job.profession,
  label: job.label,
  skillName: job.skillName,
  npcName: job.npcName,
  workplace: job.workplace,
  experience: 0,
  level: 1,
  maxLevel: 10,
  xpToOpenShop: 100,
  canOpenShop: false,
  currentUnlock: '基础帮工',
  nextUnlock: '二级制品',
  nextLevelXp: 50,
}));

function formatProgress(progress?: number) {
  if (progress === undefined) {
    return '0%';
  }
  return `${Math.floor(progress * 100)}%`;
}

function formatSavedAt(savedAt?: number) {
  if (!savedAt) {
    return '还没有睡觉存档';
  }
  return new Date(savedAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ResidentPanel({ worldId }: { worldId: Id<'worlds'> }) {
  const identity = useSessionIdentity();
  const settings = usePlayerSettings();
  const convex = useConvex();
  const sleepAndSave = useMutation(api.world.sleepAndSaveResident);
  const buyTavernMeal = useMutation(api.world.buyTavernMeal);
  const cookGardenFood = useMutation(api.world.cookGardenFood);
  const eatGardenFood = useMutation(api.world.eatGardenFood);
  const marketBuySeedBundle = useMutation(api.world.marketBuySeedBundle);
  const marketSellVegetable = useMutation(api.world.marketSellVegetable);
  const workCareerDay = useMutation(api.world.workCareerDay);
  const finishCareerShift = useMutation(api.world.finishCareerShift);
  const [saving, setSaving] = useState(false);
  const [lifeBusy, setLifeBusy] = useState<string>();
  const [marketCrop, setMarketCrop] = useState<GardenCropId>('radish');
  const [selectedProfession, setSelectedProfession] = useState<ProfessionId>('blacksmith');
  const [now, setNow] = useState(Date.now());
  const status = useQuery(api.world.residentStatus, {
    worldId,
    sessionId: identity.sessionId,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!status) {
    return (
      <div className="resident-panel">
        <h2 className="font-display text-4xl text-[#fec742]">我的居民</h2>
        <p className="mt-3 text-[#ead4aa]">正在整理你的居民档案。</p>
      </div>
    );
  }

  const rawAssets = status.assets;
  const assets = {
    ...rawAssets,
    energy: rawAssets.energy ?? 100,
    maxEnergy: rawAssets.maxEnergy ?? 100,
    food: rawAssets.food ?? 1,
    seeds: {
      radish: rawAssets.seeds?.radish ?? 4,
      greens: rawAssets.seeds?.greens ?? 3,
      carrot: rawAssets.seeds?.carrot ?? 2,
    },
    totalSeeds: rawAssets.totalSeeds ?? 9,
    seedReplicator: rawAssets.seedReplicator ?? false,
  };
  const calendar = status.calendar;
  const mailbox = status.mailbox ?? { mailboxes: 0, letters: [] };
  const market = status.market ?? {
    isOpen: false,
    dayOfMonth: 15,
    daysUntilMarket: 14,
    sellPrice: 6,
    seedBundleCost: 10,
  };
  const rawCareer = status.career ?? {
    totalJobs: 0,
    totalCoinsEarned: 0,
    shopUnlockXp: 100,
    energyCost: 10,
    workHoursLabel: '10:00-18:00',
    workedToday: false,
    lastWorkDayNumber: undefined,
    lastWorkDateLabel: undefined,
    lastWorkedProfession: undefined,
    lastWorkedProfessionLabel: undefined,
    activeJob: undefined,
    jobs: [],
    progress: [],
  };
  const career = {
    ...rawCareer,
    jobs: rawCareer.jobs.length > 0 ? rawCareer.jobs : FALLBACK_CAREER_JOBS,
    progress: rawCareer.progress.length > 0 ? rawCareer.progress : FALLBACK_CAREER_PROGRESS,
  };
  const activeShift = status.studio.activeShift;
  const activeCareerJob = career.activeJob;
  const selectedCareerJob =
    career.jobs.find((job) => job.profession === selectedProfession) ?? career.jobs[0];
  const selectedCareerWorkHours =
    selectedCareerJob?.workHoursLabel ?? career.workHoursLabel ?? '10:00-18:00';
  const activity = status.player?.activity;
  const displayCharacter =
    status.player?.character ?? status.profile?.character ?? identity.playerCharacter;
  const canSleepAndSave = status.joined && !!status.player && !saving;
  const energyPercent = Math.floor((assets.energy / assets.maxEnergy) * 100);
  const currentTimeLabel = new Date(now).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const calendarLabel = calendar
    ? `${calendar.label.slice(0, -5)} ${currentTimeLabel}`
    : `溪山历 1月1日 ${currentTimeLabel}`;
  const seeds = assets.seeds;

  const runResidentAction = async (
    key: string,
    action: () => Promise<unknown>,
    success: string,
  ) => {
    if (!status.player || lifeBusy) {
      return;
    }
    setLifeBusy(key);
    try {
      await action();
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLifeBusy(undefined);
    }
  };

  const sleepAndSaveProfile = async () => {
    if (!canSleepAndSave) {
      return;
    }
    setSaving(true);
    try {
      const inputId = await sleepAndSave({ worldId, sessionId: identity.sessionId });
      await waitForInput(convex, inputId);
      toast.success('已睡觉并保存居民档案');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="resident-panel">
      <div className="box">
        <h2 className="bg-brown-700 p-2 text-center font-display text-4xl tracking-wider shadow-solid">
          我的居民
        </h2>
      </div>

      <section className="resident-card mt-5">
        <p className="text-sm text-[#ead4aa]">身份</p>
        <h3 className="mt-1 text-3xl text-white">{status.player?.name ?? identity.playerName}</h3>
        <p className="mt-2 text-sm leading-tight text-[#ead4aa]">
          {status.joined
            ? '你已经住进溪山镇，可以移动、聊天、打工和种菜。'
            : '点击底部「互动」进入小镇，成为这里的一名居民。'}
        </p>
      </section>

      <section className="resident-card mt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-[#ead4aa]">日期</p>
            <h3 className="mt-1 text-2xl text-white">{calendarLabel}</h3>
          </div>
          <div className="text-right text-sm text-[#ead4aa]">
            <p>集市</p>
            <p>{market.isOpen ? '今日开放' : `${market.daysUntilMarket} 天后`}</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm text-[#ead4aa]">
            <span>能量</span>
            <span>
              {assets.energy}/{assets.maxEnergy}
            </span>
          </div>
          <div className="life-energy-bar mt-2">
            <span style={{ width: `${energyPercent}%` }} />
          </div>
        </div>
      </section>

      <section className="resident-card mt-4">
        <p className="text-sm text-[#ead4aa]">设置</p>
        <label className="resident-setting-row mt-3">
          <span>默认移动</span>
          <select
            value={settings.movementMode}
            onChange={(event) =>
              settings.setMovementMode(event.target.value === 'run' ? 'run' : 'walk')
            }
          >
            <option value="walk">走</option>
            <option value="run">跑</option>
          </select>
        </label>
      </section>

      <section className="resident-card mt-4">
        <p className="text-sm text-[#ead4aa]">外观</p>
        <div className="mt-3">
          <AvatarPreview character={displayCharacter} />
        </div>
        {!status.joined && (
          <div className="appearance-controls">
            <select
              className="appearance-select"
              value={identity.playerCharacter}
              onChange={(event) => identity.setPlayerCharacter(event.target.value)}
            >
              {characterAppearanceOptions.map((appearance) => (
                <option key={appearance.name} value={appearance.name}>
                  {appearance.label} - {appearance.hair} / {appearance.outfit}
                </option>
              ))}
            </select>
            <button
              className="observatory-control"
              type="button"
              onClick={identity.randomizePlayerCharacter}
            >
              随机
            </button>
          </div>
        )}
        {status.joined && (
          <p className="mt-3 text-sm leading-tight text-[#ead4aa]">
            已进入小镇。本次外观会保存在居民档案里，重新入住时继续使用。
          </p>
        )}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3">
        <div className="resident-stat">
          <span>Florins</span>
          <strong>{assets.florins}</strong>
        </div>
        <div className="resident-stat">
          <span>铜币</span>
          <strong>{assets.coins}</strong>
        </div>
        <div className="resident-stat">
          <span>蔬菜</span>
          <strong>{assets.vegetables}</strong>
        </div>
        <div className="resident-stat">
          <span>收获</span>
          <strong>{assets.harvestsCompleted}</strong>
        </div>
        <div className="resident-stat">
          <span>食物</span>
          <strong>{assets.food}</strong>
        </div>
        <div className="resident-stat">
          <span>种子</span>
          <strong>{assets.totalSeeds}</strong>
        </div>
      </section>

      <section className="resident-card mt-4">
        <p className="text-sm text-[#ead4aa]">背包</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <p>萝卜 {seeds.radish}</p>
          <p>青菜 {seeds.greens}</p>
          <p>胡萝卜 {seeds.carrot}</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!status.player || !!lifeBusy}
            type="button"
            onClick={() =>
              void runResidentAction(
                'tavern',
                () => buyTavernMeal({ worldId, playerId: status.player!.id }),
                '在酒馆吃了一顿，能量恢复了',
              )
            }
          >
            酒馆买饭
          </button>
          <button
            className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!status.player || !!lifeBusy}
            type="button"
            onClick={() =>
              void runResidentAction(
                'cook',
                () => cookGardenFood({ worldId, playerId: status.player!.id }),
                '用蔬菜做了一份吃的',
              )
            }
          >
            用菜做饭
          </button>
          <button
            className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!status.player || !!lifeBusy || assets.food <= 0}
            type="button"
            onClick={() =>
              void runResidentAction(
                'eat',
                () => eatGardenFood({ worldId, playerId: status.player!.id }),
                '吃了一份食物，能量恢复了',
              )
            }
          >
            吃东西
          </button>
        </div>
      </section>

      <section className="resident-card mt-4">
        <p className="text-sm text-[#ead4aa]">能力</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <p>绘画 {assets.paintingSkill}</p>
          <p>创造力 {assets.creativity}</p>
          <p>园艺 {assets.gardeningSkill}</p>
          <p>名声 {assets.reputation}</p>
        </div>
      </section>

      <section className="resident-card mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#ead4aa]">职业临时工</p>
          <span className="text-xs text-[#ead4aa]">{career.totalJobs} 天工</span>
        </div>
        <div className="mt-3 grid gap-2">
          <select
            className="appearance-select"
            value={selectedProfession}
            onChange={(event) => setSelectedProfession(event.target.value as ProfessionId)}
            disabled={career.workedToday || !!activeCareerJob || career.jobs.length === 0}
          >
            {career.jobs.map((job) => (
              <option key={job.profession} value={job.profession}>
                {job.label} / {job.payCoins} 铜币 / 经验 +{job.xpGain}
              </option>
            ))}
          </select>
          {selectedCareerJob && (
            <div className="career-job-preview">
              <p className="text-[#fec742]">
                {selectedCareerJob.workplace} · {selectedCareerJob.npcName}
              </p>
              <p>{selectedCareerJob.description}</p>
              <p>
                工作时间 {selectedCareerWorkHours} / 消耗能量 {career.energyCost}
              </p>
              <p>
                {selectedCareerJob.skillName ?? selectedCareerJob.label} Lv.
                {selectedCareerJob.level}/{selectedCareerJob.maxLevel ?? 10} / 距离可开店还差{' '}
                {selectedCareerJob.xpToOpenShop} 经验
              </p>
              <p>当前解锁：{selectedCareerJob.currentUnlock ?? '基础帮工'}</p>
            </div>
          )}
          {career.workedToday && (
            <p className="text-sm leading-tight text-[#ead4aa]">
              今天已经在{career.lastWorkedProfessionLabel ?? '某位居民'}那里做过一天工，
              {career.lastWorkDateLabel ?? '睡一觉'}后就能再接下一份。
            </p>
          )}
          {activeCareerJob && (
            <div className="career-job-preview">
              <p className="text-[#fec742]">
                有一份旧临时工记录：{activeCareerJob.workplace} · {activeCareerJob.title}
              </p>
              <p>
                进度 {formatProgress(activeCareerJob.progress)} / 工资 {activeCareerJob.payCoins}{' '}
                铜币
              </p>
              <div className="life-energy-bar mt-2">
                <span style={{ width: `${Math.floor(activeCareerJob.progress * 100)}%` }} />
              </div>
            </div>
          )}
          <button
            className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              !status.player ||
              !!lifeBusy ||
              career.workedToday ||
              !!activeCareerJob ||
              !selectedCareerJob
            }
            type="button"
            onClick={() =>
              selectedCareerJob &&
              void runResidentAction(
                'career-day',
                () =>
                  workCareerDay({
                    worldId,
                    playerId: status.player!.id,
                    profession: selectedCareerJob.profession,
                  }),
                `完成${selectedCareerWorkHours}临时工，拿到一天工资`,
              )
            }
          >
            做一天临时工
          </button>
          {activeCareerJob && (
            <button
              className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !status.player || !!lifeBusy || !activeCareerJob || !activeCareerJob.readyToFinish
              }
              type="button"
              onClick={() =>
                void runResidentAction(
                  'career-finish',
                  () => finishCareerShift({ worldId, playerId: status.player!.id }),
                  '旧临时工结算完成，经验上涨了',
                )
              }
            >
              领取旧工资
            </button>
          )}
        </div>
        <div className="career-progress-grid mt-3">
          {career.progress.map((entry) => (
            <span
              key={entry.profession}
              className={`career-pill ${entry.canOpenShop ? 'career-pill-ready' : ''}`}
            >
              {entry.label} Lv.{entry.level} · {entry.experience}
              <br />
              {entry.skillName ?? entry.label}
            </span>
          ))}
        </div>
      </section>

      <section className="resident-card mt-4">
        <p className="text-sm text-[#ead4aa]">今日状态</p>
        <div className="mt-3 space-y-2 text-sm leading-tight text-white">
          <p>
            职业：
            {activeCareerJob
              ? `${activeCareerJob.title} ${formatProgress(activeCareerJob.progress)}`
              : career.workedToday
                ? `今天已在${career.lastWorkedProfessionLabel ?? '居民家'}做过一天工`
                : `${career.totalJobs} 天临时工，累计 ${career.totalCoinsEarned} 铜币`}
          </p>
          <p>
            画室：
            {activeShift
              ? `${activeShift.title} ${formatProgress(activeShift.progress)}`
              : `${assets.shiftsCompleted} 个班次完成`}
          </p>
          <p>
            菜园：{status.garden.readyPlots} 块可收获，{status.garden.growingPlots} 块生长中
          </p>
          <p>
            行动：
            {activity && activity.until > Date.now()
              ? `${activity.emoji ?? ''} ${activity.description}`
              : status.joined
                ? '自由活动'
                : '未进入小镇'}
          </p>
          <p>存档：{formatSavedAt(status.profile?.lastSavedAt)}</p>
        </div>
        <button
          className="observatory-control mt-4"
          disabled={!canSleepAndSave}
          type="button"
          onClick={() => void sleepAndSaveProfile()}
        >
          {saving ? '保存中...' : '睡觉存档'}
        </button>
      </section>

      <section className="resident-card mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#ead4aa]">信箱</p>
          <span className="text-xs text-[#ead4aa]">{mailbox.mailboxes} 个门口信箱</span>
        </div>
        <div className="mt-3 space-y-2">
          {mailbox.letters.slice(0, 3).map((letter) => (
            <article key={letter.id} className="life-letter">
              <p className="text-[#fec742]">
                {letter.from} → {letter.to}
              </p>
              <p>{letter.subject}</p>
            </article>
          ))}
          {mailbox.letters.length === 0 && <p className="text-sm text-white">今天还没有新的信。</p>}
        </div>
      </section>

      <section className="resident-card mt-4">
        <p className="text-sm text-[#ead4aa]">月度集市</p>
        <p className="mt-2 text-sm leading-tight text-white">
          {market.isOpen ? '今天可以摆摊和买种子。' : `每月 ${market.dayOfMonth} 日开市。`}
        </p>
        <div className="mt-3 grid gap-2">
          <select
            className="appearance-select"
            value={marketCrop}
            onChange={(event) => setMarketCrop(event.target.value as GardenCropId)}
            disabled={!market.isOpen}
          >
            <option value="radish">萝卜种子包</option>
            <option value="greens">青菜种子包</option>
            <option value="carrot">胡萝卜种子包</option>
          </select>
          <button
            className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!status.player || !!lifeBusy || !market.isOpen}
            type="button"
            onClick={() =>
              void runResidentAction(
                'market-buy',
                () =>
                  marketBuySeedBundle({ worldId, playerId: status.player!.id, crop: marketCrop }),
                '买到一包种子',
              )
            }
          >
            买种子包
          </button>
          <button
            className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!status.player || !!lifeBusy || !market.isOpen || assets.vegetables <= 0}
            type="button"
            onClick={() =>
              void runResidentAction(
                'market-sell',
                () => marketSellVegetable({ worldId, playerId: status.player!.id }),
                '在集市卖出一份蔬菜',
              )
            }
          >
            摆摊卖菜
          </button>
        </div>
      </section>

      <section className="resident-card mt-4">
        <p className="text-sm text-[#ead4aa]">下一步</p>
        <p className="mt-2 text-sm leading-tight text-white">
          {!status.joined && '先点击「互动」进入小镇。'}
          {status.joined && status.garden.readyPlots > 0 && '去小菜园收获成熟作物。'}
          {status.joined &&
            status.garden.readyPlots === 0 &&
            !activeShift &&
            !activeCareerJob &&
            !career.workedToday &&
            '去找一个职业 NPC 做一天临时工，或去小菜园播种。'}
          {status.joined &&
            status.garden.readyPlots === 0 &&
            !activeShift &&
            !activeCareerJob &&
            career.workedToday &&
            '今天的临时工已经完成，可以种菜、社交，或者睡觉进入下一天。'}
          {status.joined &&
            activeCareerJob &&
            !activeCareerJob.readyToFinish &&
            '旧临时工还在进行中，可以先在镇上走走。'}
          {status.joined && activeCareerJob?.readyToFinish && '旧临时工完成了，去领取工资。'}
          {status.joined &&
            activeShift &&
            !activeShift.readyToFinish &&
            '画室班次还在进行中，可以先在镇上走走。'}
          {status.joined && activeShift?.readyToFinish && '画室班次完成了，去领取工资。'}
        </p>
      </section>
    </div>
  );
}

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

type GardenCropId = 'radish' | 'greens' | 'carrot';

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
  const [saving, setSaving] = useState(false);
  const [lifeBusy, setLifeBusy] = useState<string>();
  const [marketCrop, setMarketCrop] = useState<GardenCropId>('radish');
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
  const activeShift = status.studio.activeShift;
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
        <p className="text-sm text-[#ead4aa]">今日状态</p>
        <div className="mt-3 space-y-2 text-sm leading-tight text-white">
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
            '去画室接一份临时工，或去小菜园播种。'}
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

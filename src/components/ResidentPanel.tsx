import { useConvex, useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { characterAppearanceOptions } from '../../data/characters';
import { waitForInput } from '../hooks/sendInput';
import { useSessionIdentity } from '../hooks/useSessionIdentity';
import AvatarPreview from './AvatarPreview';

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
  const convex = useConvex();
  const sleepAndSave = useMutation(api.world.sleepAndSaveResident);
  const [saving, setSaving] = useState(false);
  const status = useQuery(api.world.residentStatus, {
    worldId,
    sessionId: identity.sessionId,
  });

  if (!status) {
    return (
      <div className="resident-panel">
        <h2 className="font-display text-4xl text-[#fec742]">我的居民</h2>
        <p className="mt-3 text-[#ead4aa]">正在整理你的居民档案。</p>
      </div>
    );
  }

  const assets = status.assets;
  const activeShift = status.studio.activeShift;
  const activity = status.player?.activity;
  const displayCharacter =
    status.player?.character ?? status.profile?.character ?? identity.playerCharacter;
  const canSleepAndSave = status.joined && !!status.player && !saving;

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
        <h3 className="mt-1 text-3xl text-white">
          {status.player?.name ?? identity.playerName}
        </h3>
        <p className="mt-2 text-sm leading-tight text-[#ead4aa]">
          {status.joined
            ? '你已经住进溪山镇，可以移动、聊天、打工和种菜。'
            : '点击底部「互动」进入小镇，成为这里的一名居民。'}
        </p>
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
        <p className="text-sm text-[#ead4aa]">下一步</p>
        <p className="mt-2 text-sm leading-tight text-white">
          {!status.joined && '先点击「互动」进入小镇。'}
          {status.joined && status.garden.readyPlots > 0 && '去小菜园收获成熟作物。'}
          {status.joined && status.garden.readyPlots === 0 && !activeShift && '去画室接一份临时工，或去小菜园播种。'}
          {status.joined && activeShift && !activeShift.readyToFinish && '画室班次还在进行中，可以先在镇上走走。'}
          {status.joined && activeShift?.readyToFinish && '画室班次完成了，去领取工资。'}
        </p>
      </section>
    </div>
  );
}

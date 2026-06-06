import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useSessionIdentity } from '../hooks/useSessionIdentity';

function formatProgress(progress?: number) {
  if (progress === undefined) {
    return '0%';
  }
  return `${Math.floor(progress * 100)}%`;
}

export default function ResidentPanel({ worldId }: { worldId: Id<'worlds'> }) {
  const identity = useSessionIdentity();
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
        </div>
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

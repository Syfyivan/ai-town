import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import { useServerGame } from '../hooks/serverGame';
import { useSessionIdentity } from '../hooks/useSessionIdentity';

type GardenCropId = 'radish' | 'greens' | 'carrot';
type GardenAction = 'plant' | 'water' | 'harvest';

function formatRemaining(ms?: number) {
  if (ms === undefined) {
    return '';
  }
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

export default function GardenOverlay(props: { open: boolean; onClose: () => void }) {
  const [selectedCrop, setSelectedCrop] = useState<GardenCropId>('radish');
  const [busyPlot, setBusyPlot] = useState<number>();
  const [now, setNow] = useState(Date.now());
  const identity = useSessionIdentity();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const game = useServerGame(props.open ? worldId : undefined);
  const humanTokenIdentifier = useQuery(
    api.world.userStatus,
    props.open && worldId ? { worldId, sessionId: identity.sessionId } : 'skip',
  );
  const humanPlayerId = useMemo(
    () =>
      game && humanTokenIdentifier
        ? [...game.world.players.values()].find((player) => player.human === humanTokenIdentifier)
            ?.id
        : undefined,
    [game, humanTokenIdentifier],
  );
  const status = useQuery(
    api.world.gardenStatus,
    props.open && worldId
      ? {
          worldId,
          ...(humanPlayerId ? { playerId: humanPlayerId } : {}),
        }
      : 'skip',
  );
  const plantCrop = useMutation(api.world.plantGardenCrop);
  const waterCrop = useMutation(api.world.waterGardenCrop);
  const harvestCrop = useMutation(api.world.harvestGardenCrop);

  useEffect(() => {
    if (!props.open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        props.onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props.onClose, props.open]);

  useEffect(() => {
    if (!props.open) {
      return undefined;
    }
    const hasGrowingCrop = status?.plots.some((plot) => plot.phase === 'watered');
    if (!hasGrowingCrop) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [props.open, status?.plots]);

  if (!props.open) {
    return null;
  }

  const crops = status?.garden.crops ?? [];
  const cropById = new Map(crops.map((crop) => [crop.crop, crop]));
  const gardener = status?.gardener;

  const runGardenAction = async (slot: number, action: GardenAction) => {
    if (!worldId || !humanPlayerId) {
      return;
    }
    setBusyPlot(slot);
    try {
      if (action === 'plant') {
        const crop = cropById.get(selectedCrop);
        await plantCrop({ worldId, playerId: humanPlayerId, slot, crop: selectedCrop });
        toast.success(`种下${crop?.name ?? '作物'}`);
      } else if (action === 'water') {
        await waterCrop({ worldId, playerId: humanPlayerId, slot });
        toast.success('浇水完成');
      } else {
        const harvest = await harvestCrop({ worldId, playerId: humanPlayerId, slot });
        toast.success(`收获${harvest.cropName}，获得 ${harvest.coinReward} 铜币`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyPlot(undefined);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#181425]/85 px-4 py-5 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="溪山小菜园"
    >
      <div className="garden-shell w-[980px] max-w-full overflow-hidden bg-[#262b44] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b-4 border-[#181425] bg-[#3a4466] px-5 py-4">
          <div>
            <h2 className="font-display text-5xl leading-none game-title">
              {status?.garden.name ?? '溪山小菜园'}
            </h2>
            <p className="mt-1 text-base text-[#ead4aa]">
              管理人 {status?.garden.stewardName ?? '沈梨'} / {status?.garden.notice ?? '准备翻土'}
            </p>
          </div>
          <button className="observatory-control" type="button" onClick={props.onClose}>
            离开
          </button>
        </header>

        <div className="garden-layout grid max-h-[76vh] min-h-[520px] grid-cols-[minmax(0,1fr)_280px] overflow-y-auto">
          <main className="min-w-0 p-5">
            {!humanPlayerId && (
              <div className="mb-4 border-4 border-[#181425] bg-[#6e2146] p-4 text-lg">
                先加入小镇，再来小菜园种菜。
              </div>
            )}

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="garden-stat">
                <span>铜币</span>
                <strong>{gardener?.coins ?? 0}</strong>
              </div>
              <div className="garden-stat">
                <span>蔬菜</span>
                <strong>{gardener?.vegetables ?? 0}</strong>
              </div>
              <div className="garden-stat">
                <span>园艺</span>
                <strong>{gardener?.gardeningSkill ?? 1}</strong>
              </div>
              <div className="garden-stat">
                <span>收获</span>
                <strong>{gardener?.harvestsCompleted ?? 0}</strong>
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <h3 className="font-display text-4xl leading-none text-[#fec742]">种子</h3>
                <select
                  className="garden-select"
                  value={selectedCrop}
                  onChange={(event) => setSelectedCrop(event.target.value as GardenCropId)}
                  disabled={!humanPlayerId}
                >
                  {crops.map((crop) => (
                    <option key={crop.crop} value={crop.crop}>
                      {crop.name} / {crop.growMs / 1000}s / {crop.coinReward} 铜币
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {crops.map((crop) => (
                  <div
                    key={crop.crop}
                    className={`garden-seed ${selectedCrop === crop.crop ? 'garden-seed-active' : ''}`}
                  >
                    <p className="text-xl text-white">{crop.name}</p>
                    <p className="mt-2 text-sm leading-tight text-[#ead4aa]">{crop.description}</p>
                    <p className="mt-3 text-sm text-[#fec742]">
                      成熟 {crop.growMs / 1000}s / 蔬菜 +{crop.yieldVegetables} / 园艺 +
                      {crop.skillGain}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-5 grid gap-3 sm:grid-cols-2">
              {(status?.plots ?? []).map((plot) => {
                const disabled = !humanPlayerId || busyPlot === plot.slot;
                const localRemaining =
                  plot.phase === 'watered' && plot.readyAt
                    ? Math.max(0, plot.readyAt - now)
                    : plot.remainingMs;
                const growthWidth =
                  plot.phase === 'watered' || plot.phase === 'ready'
                    ? `${Math.floor(plot.growthProgress * 100)}%`
                    : '0%';
                return (
                  <div key={plot.slot} className="garden-plot">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-2xl text-[#fec742]">地块 {plot.slot + 1}</p>
                        <p className="mt-1 text-sm text-[#ead4aa]">
                          {plot.phase === 'empty' && '空地'}
                          {plot.phase !== 'empty' && `${plot.cropName} / ${plot.phase}`}
                          {plot.phase === 'watered' && ` / ${formatRemaining(localRemaining)}`}
                        </p>
                      </div>
                      <span className="garden-soil" data-phase={plot.phase} />
                    </div>

                    <div className="mt-4 h-4 border-4 border-[#181425] bg-[#101322]">
                      <div className="h-full bg-[#99e550]" style={{ width: growthWidth }} />
                    </div>

                    {plot.phase === 'empty' && (
                      <button
                        className="observatory-control mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={disabled}
                        onClick={() => void runGardenAction(plot.slot, 'plant')}
                      >
                        播种
                      </button>
                    )}
                    {plot.phase === 'planted' && (
                      <button
                        className="observatory-control mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={disabled}
                        onClick={() => void runGardenAction(plot.slot, 'water')}
                      >
                        浇水
                      </button>
                    )}
                    {plot.phase === 'watered' && (
                      <button
                        className="observatory-control mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled
                      >
                        生长中
                      </button>
                    )}
                    {plot.phase === 'ready' && (
                      <button
                        className="observatory-control mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={disabled}
                        onClick={() => void runGardenAction(plot.slot, 'harvest')}
                      >
                        收获
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          </main>

          <aside className="border-l-4 border-[#181425] bg-[#1f2336] p-5">
            <h3 className="font-display text-4xl leading-none text-[#fec742]">园艺榜</h3>
            <div className="mt-4 flex flex-col gap-3">
              {(status?.leaderboard ?? []).map((entry, index) => (
                <div key={entry.playerId} className="garden-rank">
                  <span className="text-[#fec742]">#{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-white">{entry.gardenerName}</p>
                    <p className="text-sm text-[#ead4aa]">
                      蔬菜 {entry.vegetables} / 园艺 {entry.gardeningSkill}
                    </p>
                  </div>
                </div>
              ))}
              {(status?.leaderboard ?? []).length === 0 && (
                <p className="text-sm leading-tight text-[#ead4aa]">还没有人收获小菜园。</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

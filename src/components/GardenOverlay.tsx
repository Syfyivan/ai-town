import { useMutation, useQuery } from 'convex/react';
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import { useServerGame } from '../hooks/serverGame';
import { useSessionIdentity } from '../hooks/useSessionIdentity';
import AvatarPreview from './AvatarPreview';

type GardenCropId = 'radish' | 'greens' | 'carrot';
type GardenAction = 'plant' | 'water' | 'harvest' | 'saveSeeds';
type GardenPosition = { x: number; y: number };

const GARDEN_BOARD_WIDTH = 5;
const GARDEN_BOARD_HEIGHT = 4;
const GARDEN_PLOT_POSITIONS: Record<number, GardenPosition> = {
  0: { x: 1, y: 1 },
  1: { x: 2, y: 1 },
  2: { x: 1, y: 2 },
  3: { x: 2, y: 2 },
};

function formatRemaining(ms?: number) {
  if (ms === undefined) {
    return '';
  }
  return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function isTextInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

function slotToPosition(slot: number) {
  return GARDEN_PLOT_POSITIONS[slot] ?? { x: slot % 2, y: Math.floor(slot / 2) };
}

function clampGardenPosition(position: GardenPosition) {
  return {
    x: Math.max(0, Math.min(GARDEN_BOARD_WIDTH - 1, position.x)),
    y: Math.max(0, Math.min(GARDEN_BOARD_HEIGHT - 1, position.y)),
  };
}

function nextCrop(crops: GardenCropId[], selectedCrop: GardenCropId) {
  const index = crops.indexOf(selectedCrop);
  return crops[(index + 1 + crops.length) % crops.length] ?? selectedCrop;
}

export default function GardenOverlay(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const [selectedCrop, setSelectedCrop] = useState<GardenCropId>('radish');
  const [gardenerPosition, setGardenerPosition] = useState<GardenPosition>({ x: 0, y: 3 });
  const [facing, setFacing] = useState<GardenPosition>({ x: 1, y: 0 });
  const [busyPlot, setBusyPlot] = useState<number>();
  const [toolBusy, setToolBusy] = useState<string>();
  const [now, setNow] = useState(Date.now());
  const identity = useSessionIdentity();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const game = useServerGame(open ? worldId : undefined);
  const humanTokenIdentifier = useQuery(
    api.world.userStatus,
    open && worldId ? { worldId, sessionId: identity.sessionId } : 'skip',
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
    open && worldId
      ? {
          worldId,
          ...(humanPlayerId ? { playerId: humanPlayerId } : {}),
        }
      : 'skip',
  );
  const plantCrop = useMutation(api.world.plantGardenCrop);
  const waterCrop = useMutation(api.world.waterGardenCrop);
  const harvestCrop = useMutation(api.world.harvestGardenCrop);
  const saveSeeds = useMutation(api.world.saveGardenSeeds);
  const buySeedReplicator = useMutation(api.world.buySeedReplicator);

  const crops = status?.garden.crops ?? [];
  const cropById = useMemo(() => new Map(crops.map((crop) => [crop.crop, crop])), [crops]);
  const cropIds = useMemo(() => crops.map((crop) => crop.crop), [crops]);
  const plotsByPosition = useMemo(
    () =>
      new Map(
        (status?.plots ?? []).map((plot) => {
          const position = slotToPosition(plot.slot);
          return [`${position.x}:${position.y}`, plot] as const;
        }),
      ),
    [status?.plots],
  );
  const gardener = status?.gardener;
  const facingPosition = clampGardenPosition({
    x: gardenerPosition.x + facing.x,
    y: gardenerPosition.y + facing.y,
  });
  const selectedPlot =
    plotsByPosition.get(`${gardenerPosition.x}:${gardenerPosition.y}`) ??
    plotsByPosition.get(`${facingPosition.x}:${facingPosition.y}`);

  const runGardenAction = useCallback(
    async (slot: number, action: GardenAction) => {
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
        } else if (action === 'harvest') {
          const harvest = await harvestCrop({ worldId, playerId: humanPlayerId, slot });
          toast.success(`收获${harvest.cropName}，获得 ${harvest.coinReward} 铜币`);
        } else {
          const saving = await saveSeeds({ worldId, playerId: humanPlayerId, slot });
          if (saving.success) {
            toast.success(`留种成功，得到 ${saving.seedCount} 粒${saving.cropName}种子`);
          } else {
            toast.info(`这次${saving.cropName}留种失败了`);
          }
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setBusyPlot(undefined);
      }
    },
    [cropById, harvestCrop, humanPlayerId, plantCrop, saveSeeds, selectedCrop, waterCrop, worldId],
  );

  const runSelectedPlotAction = useCallback(() => {
    if (!selectedPlot) {
      return;
    }
    if (selectedPlot.phase === 'empty') {
      void runGardenAction(selectedPlot.slot, 'plant');
    } else if (selectedPlot.phase === 'planted') {
      void runGardenAction(selectedPlot.slot, 'water');
    } else if (selectedPlot.phase === 'ready') {
      void runGardenAction(selectedPlot.slot, 'harvest');
    }
  }, [runGardenAction, selectedPlot]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const hasGrowingCrop = status?.plots.some((plot) => plot.phase === 'watered');
    if (!hasGrowingCrop) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [open, status?.plots]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const movement: Record<string, { x: number; y: number }> = {
        w: { x: 0, y: -1 },
        arrowup: { x: 0, y: -1 },
        a: { x: -1, y: 0 },
        arrowleft: { x: -1, y: 0 },
        s: { x: 0, y: 1 },
        arrowdown: { x: 0, y: 1 },
        d: { x: 1, y: 0 },
        arrowright: { x: 1, y: 0 },
      };
      if (movement[key]) {
        event.preventDefault();
        setFacing(movement[key]);
        setGardenerPosition((position) =>
          clampGardenPosition({
            x: position.x + movement[key].x,
            y: position.y + movement[key].y,
          }),
        );
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        runSelectedPlotAction();
        return;
      }
      if (key === 'z') {
        event.preventDefault();
        setSelectedCrop((crop) => nextCrop(cropIds, crop));
        return;
      }
      if (key === 'escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cropIds, onClose, open, runSelectedPlotAction]);

  if (!open) {
    return null;
  }

  const selectedCropConfig = cropById.get(selectedCrop);
  const selectedCropSeeds = selectedCropConfig?.seedsAvailable ?? 0;
  const energy = gardener?.energy ?? 100;
  const maxEnergy = 100;
  const energyPercent = Math.floor((energy / maxEnergy) * 100);
  const baseSeedSavingRate = Math.round((status?.garden.seedSaving.baseSuccessRate ?? 0.4) * 100);
  const replicatorSeedSavingRate = Math.round(
    (status?.garden.seedSaving.replicatorSuccessRate ?? 0.95) * 100,
  );
  const replicatorCost = status?.garden.seedSaving.seedReplicatorCost ?? 80;
  const gardenCells = Array.from(
    { length: GARDEN_BOARD_WIDTH * GARDEN_BOARD_HEIGHT },
    (_, index) => ({
      x: index % GARDEN_BOARD_WIDTH,
      y: Math.floor(index / GARDEN_BOARD_WIDTH),
    }),
  );

  return (
    <section className="scene-page scene-page-garden text-white" aria-label="溪山小菜园">
      <header className="scene-header">
        <div>
          <h2 className="font-display text-5xl leading-none game-title">
            {status?.garden.name ?? '溪山小菜园'}
          </h2>
          <p className="mt-1 text-base text-[#ead4aa]">
            管理人 {status?.garden.stewardName ?? '沈梨'} / {status?.garden.notice ?? '准备翻土'}
          </p>
        </div>
        <button className="observatory-control" type="button" onClick={onClose}>
          返回小镇
        </button>
      </header>

      <div className="scene-layout garden-layout">
        <main className="scene-main">
          {!humanPlayerId && (
            <div className="mb-4 border-4 border-[#181425] bg-[#6e2146] p-4 text-lg">
              先加入小镇，再来小菜园种菜。
            </div>
          )}

          <section
            className="garden-board"
            style={
              {
                '--garden-board-width': GARDEN_BOARD_WIDTH,
                '--garden-board-height': GARDEN_BOARD_HEIGHT,
              } as CSSProperties
            }
          >
            {gardenCells.map((cell) => {
              const plot = plotsByPosition.get(`${cell.x}:${cell.y}`);
              if (!plot) {
                return (
                  <button
                    key={`${cell.x}:${cell.y}`}
                    className="garden-tile garden-ground"
                    style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1 }}
                    type="button"
                    onClick={() => setGardenerPosition(cell)}
                  />
                );
              }
              const localRemaining =
                plot.phase === 'watered' && plot.readyAt
                  ? Math.max(0, plot.readyAt - now)
                  : plot.remainingMs;
              const growthWidth =
                plot.phase === 'watered' || plot.phase === 'ready'
                  ? `${Math.floor(plot.growthProgress * 100)}%`
                  : '0%';
              return (
                <button
                  key={plot.slot}
                  className={`garden-tile ${
                    selectedPlot?.slot === plot.slot ? 'garden-tile-active' : ''
                  }`}
                  style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1 }}
                  type="button"
                  onClick={() => setGardenerPosition(cell)}
                >
                  <span className="garden-soil" data-phase={plot.phase} />
                  <strong>{plot.phase === 'empty' ? '空地' : plot.cropName}</strong>
                  <small>
                    {plot.phase === 'watered' && formatRemaining(localRemaining)}
                    {plot.phase === 'ready' && '成熟'}
                    {plot.phase === 'planted' && '待浇水'}
                  </small>
                  <span className="garden-tile-progress">
                    <span style={{ width: growthWidth }} />
                  </span>
                </button>
              );
            })}
            <div
              className="garden-player-marker"
              style={{
                gridColumn: gardenerPosition.x + 1,
                gridRow: gardenerPosition.y + 1,
              }}
            >
              <AvatarPreview character={identity.playerCharacter} scale={2} showLabels={false} />
              <span
                className="garden-facing-dot"
                style={
                  {
                    left: `calc(50% + ${facing.x * 34}px)`,
                    top: `calc(55% + ${facing.y * 34}px)`,
                  } as CSSProperties
                }
              />
            </div>
          </section>

          <section className="scene-card mt-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              <div className="garden-stat">
                <span>能量</span>
                <strong>
                  {energy}/{maxEnergy}
                </strong>
              </div>
              <div className="garden-stat">
                <span>食物</span>
                <strong>{gardener?.food ?? 1}</strong>
              </div>
              <div className="garden-stat">
                <span>留种</span>
                <strong>
                  {gardener?.seedReplicator
                    ? `${replicatorSeedSavingRate}%`
                    : `${baseSeedSavingRate}%`}
                </strong>
              </div>
              <div className="garden-stat">
                <span>种子复制机</span>
                <strong>{gardener?.seedReplicator ? '有' : '无'}</strong>
              </div>
            </div>
            <div className="life-energy-bar mt-4">
              <span style={{ width: `${energyPercent}%` }} />
            </div>
          </section>

          <section className="scene-card mt-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#ead4aa]">当前种子</p>
                <h3 className="mt-1 text-2xl text-[#fec742]">
                  {selectedCropConfig?.name ?? '萝卜'}
                </h3>
                <p className="mt-1 text-sm leading-tight text-[#ead4aa]">
                  {selectedCropConfig?.description ?? '适合新手的小菜园作物。'} 背包还有{' '}
                  {selectedCropSeeds} 粒。
                </p>
              </div>
              <select
                className="garden-select"
                value={selectedCrop}
                onChange={(event) => setSelectedCrop(event.target.value as GardenCropId)}
                disabled={!humanPlayerId}
              >
                {crops.map((crop) => (
                  <option key={crop.crop} value={crop.crop}>
                    {crop.name} / {crop.seedsAvailable} 粒 / {crop.growMs / 1000}s
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                className="observatory-control w-full disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={
                  !humanPlayerId ||
                  !selectedPlot ||
                  busyPlot === selectedPlot.slot ||
                  selectedPlot.phase === 'watered' ||
                  (selectedPlot.phase === 'empty' && selectedCropSeeds <= 0)
                }
                onClick={() => runSelectedPlotAction()}
              >
                {selectedPlot?.phase === 'empty' && '播种'}
                {selectedPlot?.phase === 'planted' && '浇水'}
                {selectedPlot?.phase === 'watered' && '生长中'}
                {selectedPlot?.phase === 'ready' && '收获'}
                {!selectedPlot && '整理地块'}
              </button>
              <button
                className="observatory-control w-full disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={
                  !humanPlayerId ||
                  !selectedPlot ||
                  busyPlot === selectedPlot.slot ||
                  selectedPlot.phase !== 'ready'
                }
                onClick={() => {
                  if (selectedPlot) {
                    void runGardenAction(selectedPlot.slot, 'saveSeeds');
                  }
                }}
              >
                留种
              </button>
            </div>
          </section>

          <section className="scene-card mt-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div>
                <p className="text-sm text-[#ead4aa]">种子复制机</p>
                <p className="mt-1 text-sm leading-tight text-white">
                  普通留种成功率 {baseSeedSavingRate}%；装上复制机后成功率{' '}
                  {replicatorSeedSavingRate}%。
                </p>
              </div>
              <button
                className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!humanPlayerId || !!toolBusy || gardener?.seedReplicator}
                type="button"
                onClick={() => {
                  if (!worldId || !humanPlayerId) {
                    return;
                  }
                  void (async () => {
                    setToolBusy('replicator');
                    try {
                      const result = await buySeedReplicator({
                        worldId,
                        playerId: humanPlayerId,
                      });
                      toast.success(
                        result.alreadyOwned
                          ? '已经有种子复制机了'
                          : `买到种子复制机，花费 ${replicatorCost}`,
                      );
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : String(error));
                    } finally {
                      setToolBusy(undefined);
                    }
                  })();
                }}
              >
                {gardener?.seedReplicator ? '已拥有' : `${replicatorCost} 购买`}
              </button>
            </div>
          </section>
        </main>

        <aside className="scene-sidebar">
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
    </section>
  );
}

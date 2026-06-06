import { useMutation, useQuery } from 'convex/react';
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import { useServerGame } from '../hooks/serverGame';
import { useSessionIdentity } from '../hooks/useSessionIdentity';
import AvatarPreview from './AvatarPreview';

type StudioFocus = 'sketch' | 'color' | 'detail';
type RoomPosition = { x: number; y: number };

const ROOM_WIDTH = 5;
const ROOM_HEIGHT = 4;

const STUDIO_STATIONS: Array<{
  id: string;
  title: string;
  role: string;
  focus: StudioFocus;
  position: RoomPosition;
}> = [
  {
    id: 'easel',
    title: '画架',
    role: '构图打底',
    focus: 'sketch',
    position: { x: 1, y: 1 },
  },
  {
    id: 'mixer',
    title: '调色台',
    role: '调色上色',
    focus: 'color',
    position: { x: 3, y: 1 },
  },
  {
    id: 'frame',
    title: '装裱桌',
    role: '精修装裱',
    focus: 'detail',
    position: { x: 2, y: 2 },
  },
];

function shiftProgress(now: number, shift: { startedAt: number; endsAt: number }) {
  const duration = shift.endsAt - shift.startedAt;
  if (duration <= 0) {
    return 1;
  }
  return Math.min(1, Math.max(0, (now - shift.startedAt) / duration));
}

function formatRemaining(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${seconds}s`;
}

function clampRoomPosition(position: RoomPosition) {
  return {
    x: Math.max(0, Math.min(ROOM_WIDTH - 1, position.x)),
    y: Math.max(0, Math.min(ROOM_HEIGHT - 1, position.y)),
  };
}

function sameRoomPosition(a: RoomPosition, b: RoomPosition) {
  return a.x === b.x && a.y === b.y;
}

function isTextInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export default function ArtStudioOverlay(props: { open: boolean; onClose: () => void }) {
  const { open, onClose } = props;
  const [focus, setFocus] = useState<StudioFocus>('sketch');
  const [painterPosition, setPainterPosition] = useState<RoomPosition>({ x: 2, y: 3 });
  const [submitting, setSubmitting] = useState(false);
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
    api.world.artStudioStatus,
    open && worldId
      ? {
          worldId,
          ...(humanPlayerId ? { playerId: humanPlayerId } : {}),
        }
      : 'skip',
  );
  const startShift = useMutation(api.world.startArtStudioShift);
  const finishShift = useMutation(api.world.finishArtStudioShift);

  const activeShift = status?.activeShift;
  const progress = activeShift ? shiftProgress(now, activeShift) : 0;
  const readyToFinish = !!activeShift && progress >= 1;
  const jobs = status?.studio.jobs ?? [];
  const worker = status?.worker;
  const currentStation = STUDIO_STATIONS.find((station) =>
    sameRoomPosition(station.position, painterPosition),
  );
  const selectedFocus = currentStation?.focus ?? focus;
  const selectedJob = jobs.find((job) => job.focus === selectedFocus) ?? jobs[0];

  const onStartShift = useCallback(
    async (jobFocus: StudioFocus) => {
      if (!worldId || !humanPlayerId) {
        return;
      }
      setSubmitting(true);
      try {
        await startShift({ worldId, playerId: humanPlayerId, focus: jobFocus });
        const job = jobs.find((candidate) => candidate.focus === jobFocus);
        toast.success(`开始${job?.title ?? '画室工作'}`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : String(error));
      } finally {
        setSubmitting(false);
      }
    },
    [humanPlayerId, jobs, startShift, worldId],
  );

  const onFinishShift = useCallback(async () => {
    if (!worldId || !humanPlayerId) {
      return;
    }
    setSubmitting(true);
    try {
      const outcome = await finishShift({ worldId, playerId: humanPlayerId });
      toast.success(`收入 ${outcome.earnedFlorins} Florins`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }, [finishShift, humanPlayerId, worldId]);

  const runStationAction = useCallback(() => {
    if (activeShift) {
      if (readyToFinish) {
        void onFinishShift();
      }
      return;
    }
    const stationFocus = currentStation?.focus ?? selectedJob?.focus;
    if (stationFocus) {
      void onStartShift(stationFocus);
    }
  }, [activeShift, currentStation?.focus, onFinishShift, onStartShift, readyToFinish, selectedJob]);

  useEffect(() => {
    if (!open || !status?.activeShift) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [open, status?.activeShift]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      const movement: Record<string, RoomPosition> = {
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
        setPainterPosition((position) =>
          clampRoomPosition({
            x: position.x + movement[key].x,
            y: position.y + movement[key].y,
          }),
        );
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        runStationAction();
        return;
      }
      if (key === 'z' || key === 'escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open, runStationAction]);

  if (!open) {
    return null;
  }

  return (
    <section className="scene-page scene-page-studio text-white" aria-label="溪山画室">
      <header className="scene-header">
        <div>
          <h2 className="font-display text-5xl leading-none game-title">
            {status?.studio.name ?? '溪山画室'}
          </h2>
          <p className="mt-1 text-base text-[#ead4aa]">
            老板 {status?.studio.ownerName ?? '顾南星'} / {status?.studio.notice ?? '准备开门'}
          </p>
        </div>
        <button className="observatory-control" type="button" onClick={onClose}>
          返回小镇
        </button>
      </header>

      <div className="scene-layout studio-layout">
        <main className="scene-main">
          {!humanPlayerId && (
            <div className="studio-notice mb-4 border-4 border-[#181425] bg-[#6e2146] p-4 text-lg">
              先加入小镇，再来画室应聘。
            </div>
          )}

          <section className="studio-room" style={{ '--room-width': ROOM_WIDTH } as CSSProperties}>
            {STUDIO_STATIONS.map((station) => (
              <button
                key={station.id}
                className={`studio-station ${
                  sameRoomPosition(station.position, painterPosition) ? 'studio-station-active' : ''
                }`}
                style={{
                  gridColumn: station.position.x + 1,
                  gridRow: station.position.y + 1,
                }}
                type="button"
                onClick={() => {
                  setPainterPosition(station.position);
                  setFocus(station.focus);
                }}
              >
                <span>{station.title}</span>
                <strong>{station.role}</strong>
              </button>
            ))}
            <div
              className="studio-player-marker"
              style={{ gridColumn: painterPosition.x + 1, gridRow: painterPosition.y + 1 }}
            >
              <AvatarPreview character={identity.playerCharacter} scale={2} showLabels={false} />
            </div>
          </section>

          <section className="scene-card mt-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="studio-stat">
                <span>钱包</span>
                <strong>{worker?.florins ?? 0}</strong>
              </div>
              <div className="studio-stat">
                <span>绘画</span>
                <strong>{worker?.paintingSkill ?? 1}</strong>
              </div>
              <div className="studio-stat">
                <span>创造力</span>
                <strong>{worker?.creativity ?? 1}</strong>
              </div>
              <div className="studio-stat">
                <span>名声</span>
                <strong>{worker?.reputation ?? 0}</strong>
              </div>
              <div className="studio-stat">
                <span>班次</span>
                <strong>{worker?.shiftsCompleted ?? 0}</strong>
              </div>
            </div>
          </section>

          <section className="scene-card mt-5">
            {activeShift ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-2xl text-[#fec742]">{activeShift.title}</h3>
                    <p className="mt-1 text-sm leading-tight text-[#ead4aa]">
                      {activeShift.description}
                    </p>
                  </div>
                  <strong className="shrink-0 text-2xl">{Math.floor(progress * 100)}%</strong>
                </div>
                <div className="mt-4 h-5 border-4 border-[#181425] bg-[#101322]">
                  <div
                    className="h-full bg-[#5acde8]"
                    style={{ width: `${Math.floor(progress * 100)}%` }}
                  />
                </div>
                <button
                  className="observatory-control mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!readyToFinish || submitting}
                  onClick={() => void onFinishShift()}
                >
                  {readyToFinish
                    ? '领取工资'
                    : `作画中 ${formatRemaining(activeShift.endsAt - now)}`}
                </button>
              </>
            ) : (
              <>
                <h3 className="text-2xl text-[#fec742]">{selectedJob?.title ?? '等待岗位'}</h3>
                <p className="mt-1 text-sm leading-tight text-[#ead4aa]">
                  {selectedJob?.description ?? '画室正在整理今日订单。'}
                </p>
                <p className="mt-3 text-sm text-[#fec742]">
                  {selectedJob
                    ? `${selectedJob.payPreview} Florins / 绘画 +${selectedJob.skillGain} / 创造力 +${selectedJob.creativityGain}`
                    : '暂无可接岗位'}
                </p>
                <button
                  className="observatory-control mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                  type="button"
                  disabled={!humanPlayerId || !selectedJob || submitting}
                  onClick={() => void onStartShift(selectedFocus)}
                >
                  应聘临时工
                </button>
              </>
            )}
          </section>
        </main>

        <aside className="scene-sidebar">
          <h3 className="font-display text-4xl leading-none text-[#fec742]">画工榜</h3>
          <div className="mt-4 flex flex-col gap-3">
            {(status?.leaderboard ?? []).map((entry, index) => (
              <div key={entry.playerId} className="studio-rank">
                <span className="text-[#fec742]">#{index + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-white">{entry.painterName}</p>
                  <p className="text-sm text-[#ead4aa]">
                    {entry.florins} Florins / 绘画 {entry.paintingSkill}
                  </p>
                </div>
              </div>
            ))}
            {(status?.leaderboard ?? []).length === 0 && (
              <p className="text-sm leading-tight text-[#ead4aa]">还没有人完成画室临时工。</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

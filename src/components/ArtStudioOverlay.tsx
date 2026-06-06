import { useMutation, useQuery } from 'convex/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import { useServerGame } from '../hooks/serverGame';

type StudioFocus = 'sketch' | 'color' | 'detail';

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

export default function ArtStudioOverlay(props: { open: boolean; onClose: () => void }) {
  const [focus, setFocus] = useState<StudioFocus>('sketch');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const game = useServerGame(props.open ? worldId : undefined);
  const humanTokenIdentifier = useQuery(
    api.world.userStatus,
    props.open && worldId ? { worldId } : 'skip',
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
    props.open && worldId
      ? {
          worldId,
          ...(humanPlayerId ? { playerId: humanPlayerId } : {}),
        }
      : 'skip',
  );
  const startShift = useMutation(api.world.startArtStudioShift);
  const finishShift = useMutation(api.world.finishArtStudioShift);

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
    if (!props.open || !status?.activeShift) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [props.open, status?.activeShift]);

  if (!props.open) {
    return null;
  }

  const activeShift = status?.activeShift;
  const progress = activeShift ? shiftProgress(now, activeShift) : 0;
  const readyToFinish = !!activeShift && progress >= 1;
  const jobs = status?.studio.jobs ?? [];
  const selectedJob = jobs.find((job) => job.focus === focus) ?? jobs[0];
  const worker = status?.worker;

  const onStartShift = async () => {
    if (!worldId || !humanPlayerId || !selectedJob) {
      return;
    }
    setSubmitting(true);
    try {
      await startShift({ worldId, playerId: humanPlayerId, focus });
      toast.success(`开始${selectedJob.title}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const onFinishShift = async () => {
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
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#181425]/85 px-4 py-5 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="溪山画室"
    >
      <div className="studio-shell w-[980px] max-w-full overflow-hidden bg-[#262b44] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b-4 border-[#181425] bg-[#3a4466] px-5 py-4">
          <div>
            <h2 className="font-display text-5xl leading-none game-title">
              {status?.studio.name ?? '溪山画室'}
            </h2>
            <p className="mt-1 text-base text-[#ead4aa]">
              老板 {status?.studio.ownerName ?? '顾南星'} / {status?.studio.notice ?? '准备开门'}
            </p>
          </div>
          <button className="observatory-control" type="button" onClick={props.onClose}>
            离开
          </button>
        </header>

        <div className="studio-layout grid max-h-[76vh] min-h-[520px] grid-cols-[minmax(0,1fr)_280px] overflow-y-auto">
          <main className="min-w-0 p-5">
            {!humanPlayerId && (
              <div className="studio-notice mb-4 border-4 border-[#181425] bg-[#6e2146] p-4 text-lg">
                先加入小镇，再来画室应聘。
              </div>
            )}

            <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
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
            </section>

            <section className="mt-5">
              <div className="mb-3 flex items-end justify-between gap-3">
                <h3 className="font-display text-4xl leading-none text-[#fec742]">今日岗位</h3>
                {activeShift && (
                  <span className="text-sm text-[#ead4aa]">
                    剩余 {formatRemaining(activeShift.endsAt - now)}
                  </span>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {jobs.map((job) => (
                  <button
                    key={job.focus}
                    className={`studio-job text-left ${focus === job.focus ? 'studio-job-active' : ''}`}
                    type="button"
                    disabled={!!activeShift || submitting}
                    onClick={() => setFocus(job.focus)}
                  >
                    <span className="block text-xl text-white">{job.title}</span>
                    <span className="mt-2 block text-sm leading-tight text-[#ead4aa]">
                      {job.description}
                    </span>
                    <span className="mt-3 block text-sm text-[#fec742]">
                      {job.payPreview} Florins / 绘画 +{job.skillGain} / 创造力 +
                      {job.creativityGain}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-5 border-4 border-[#181425] bg-[#181425]/45 p-4">
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
                    {readyToFinish ? '领取工资' : '作画中'}
                  </button>
                </>
              ) : (
                <>
                  <h3 className="text-2xl text-[#fec742]">
                    {selectedJob?.title ?? '等待岗位'}
                  </h3>
                  <p className="mt-1 text-sm leading-tight text-[#ead4aa]">
                    {selectedJob?.description ?? '画室正在整理今日订单。'}
                  </p>
                  <button
                    className="observatory-control mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
                    type="button"
                    disabled={!humanPlayerId || !selectedJob || submitting}
                    onClick={() => void onStartShift()}
                  >
                    应聘临时工
                  </button>
                </>
              )}
            </section>
          </main>

          <aside className="border-l-4 border-[#181425] bg-[#1f2336] p-5">
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
              {status?.leaderboard.length === 0 && (
                <p className="text-sm leading-tight text-[#ead4aa]">还没有人完成画室临时工。</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

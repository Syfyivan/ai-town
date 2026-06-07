import { useMutation, useQuery } from 'convex/react';
import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import AvatarPreview from './AvatarPreview';
import { getProfessionBuilding, ProfessionId } from './professionCatalog';
import { useSessionIdentity } from '../hooks/useSessionIdentity';

type RoomPosition = { x: number; y: number };

const ROOM_WIDTH = 7;
const ROOM_HEIGHT = 5;
const DESK_POSITION = { x: 3, y: 1 };
const PAPER_POSITION = { x: 3, y: 2 };
const DOOR_POSITION = { x: 3, y: 4 };

function isTextInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
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

function manhattanDistance(a: RoomPosition, b: RoomPosition) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export default function ProfessionWorkOverlay(props: {
  open: boolean;
  profession: ProfessionId;
  onClose: () => void;
}) {
  const { open, profession, onClose } = props;
  const building = getProfessionBuilding(profession);
  const identity = useSessionIdentity();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const worldId = worldStatus?.worldId;
  const status = useQuery(
    api.world.residentStatus,
    open && worldId ? { worldId, sessionId: identity.sessionId } : 'skip',
  );
  const workCareerDay = useMutation(api.world.workCareerDay);
  const [playerPosition, setPlayerPosition] = useState<RoomPosition>(DOOR_POSITION);
  const [facing, setFacing] = useState<RoomPosition>({ x: 0, y: -1 });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const career = status?.career;
  const job = career?.jobs.find((candidate) => candidate.profession === profession);
  const progress = career?.progress.find((entry) => entry.profession === profession);
  const workedToday = career?.workedToday ?? false;
  const workedHereToday = career?.lastWorkedProfession === profession;
  const canReachPaper = manhattanDistance(playerPosition, PAPER_POSITION) <= 1;
  const registrationDisabled = !status?.player || workedToday || submitting;
  const workHoursLabel = job?.workHoursLabel ?? career?.workHoursLabel ?? '10:00-18:00';
  const level = progress?.level ?? 1;
  const maxLevel = progress?.maxLevel ?? 10;
  const experience = progress?.experience ?? 0;
  const payCoins = job?.payCoins ?? building.payCoins;
  const xpGain = job?.xpGain ?? building.xpGain;
  const jobTitle = job?.title ?? building.jobTitle;
  const jobDescription = job?.description ?? building.jobDescription;
  const currentUnlock = progress?.currentUnlock ?? building.currentUnlock;
  const nextUnlock = progress ? progress.nextUnlock : building.nextUnlock;
  const nextLevelXp = progress ? progress.nextLevelXp : building.nextLevelXp;

  const roomCells = useMemo(
    () =>
      Array.from({ length: ROOM_WIDTH * ROOM_HEIGHT }, (_, index) => ({
        x: index % ROOM_WIDTH,
        y: Math.floor(index / ROOM_WIDTH),
      })),
    [],
  );

  const requestRegistration = useCallback(() => {
    if (!status?.player) {
      toast.info('先加入小镇，再来报名临时工。');
      return;
    }
    if (!canReachPaper) {
      toast.info('先走到接待桌前，再查看桌上的报名纸。');
      return;
    }
    if (workedToday) {
      toast.info(
        workedHereToday
          ? `今天已经在${building.buildingName}做过一天工了。`
          : `今天已经做过一份临时工了，睡一觉明天再来。`,
      );
      return;
    }
    setConfirmOpen(true);
  }, [building.buildingName, canReachPaper, status?.player, workedHereToday, workedToday]);

  const confirmRegistration = useCallback(async () => {
    if (!worldId || !status?.player || registrationDisabled) {
      return;
    }
    setSubmitting(true);
    try {
      const outcome = await workCareerDay({
        worldId,
        playerId: status.player.id,
        profession,
      });
      toast.success(
        `${building.label}完成：${outcome.payCoins} 铜币，${building.skillName} +${outcome.xpGain}`,
      );
      setConfirmOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }, [
    building.label,
    building.skillName,
    profession,
    registrationDisabled,
    status?.player,
    workCareerDay,
    worldId,
  ]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    setPlayerPosition(DOOR_POSITION);
    setFacing({ x: 0, y: -1 });
    setConfirmOpen(false);
    return undefined;
  }, [open, profession]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (confirmOpen) {
        if (key === 'escape' || key === 'z') {
          event.preventDefault();
          setConfirmOpen(false);
        }
        if (key === 'enter' || key === 'x') {
          event.preventDefault();
          void confirmRegistration();
        }
        return;
      }

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
        setFacing(movement[key]);
        setPlayerPosition((position) =>
          clampRoomPosition({
            x: position.x + movement[key].x,
            y: position.y + movement[key].y,
          }),
        );
        return;
      }
      if (key === 'x') {
        event.preventDefault();
        requestRegistration();
        return;
      }
      if (key === 'z' || key === 'escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmOpen, confirmRegistration, onClose, open, requestRegistration]);

  if (!open) {
    return null;
  }

  return (
    <section
      className="scene-page scene-page-profession text-white"
      aria-label={building.buildingName}
    >
      <header className="scene-header">
        <div>
          <h2 className="font-display text-5xl leading-none game-title">{building.buildingName}</h2>
          <p className="mt-1 text-base text-[#ead4aa]">
            {building.ownerName} / {building.interiorNotice}
          </p>
        </div>
        <button className="observatory-control" type="button" onClick={onClose}>
          返回小镇
        </button>
      </header>

      <div className="scene-layout profession-layout">
        <main className="scene-main">
          {!status?.joined && (
            <div className="mb-4 border-4 border-[#181425] bg-[#6e2146] p-4 text-lg">
              先加入小镇，再来{building.buildingName}报名学徒。
            </div>
          )}

          <section
            className="profession-room"
            style={
              {
                '--profession-room-width': ROOM_WIDTH,
                '--profession-room-height': ROOM_HEIGHT,
                '--profession-accent': `#${building.accent.toString(16).padStart(6, '0')}`,
              } as CSSProperties
            }
          >
            {roomCells.map((cell) => {
              const isDesk = sameRoomPosition(cell, DESK_POSITION);
              const isPaper = sameRoomPosition(cell, PAPER_POSITION);
              const isDoor = sameRoomPosition(cell, DOOR_POSITION);
              return (
                <button
                  key={`${cell.x}:${cell.y}`}
                  className={`profession-tile ${isDesk ? 'profession-desk' : ''} ${
                    isPaper ? 'profession-paper' : ''
                  } ${isDoor ? 'profession-door' : ''} ${
                    canReachPaper && isPaper ? 'profession-paper-reachable' : ''
                  }`}
                  style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1 }}
                  type="button"
                  onClick={() => setPlayerPosition(cell)}
                  onContextMenu={(event) => {
                    if (!isPaper) {
                      return;
                    }
                    event.preventDefault();
                    requestRegistration();
                  }}
                >
                  {isDesk && (
                    <>
                      <span>{building.deskTitle}</span>
                      <strong>接待</strong>
                    </>
                  )}
                  {isPaper && (
                    <>
                      <span className="profession-paper-icon" />
                      <strong>{building.paperTitle}</strong>
                      <small>右键 / X</small>
                    </>
                  )}
                  {isDoor && <span className="profession-door-label">门口</span>}
                </button>
              );
            })}
            <div
              className="profession-player-marker"
              style={{ gridColumn: playerPosition.x + 1, gridRow: playerPosition.y + 1 }}
            >
              <AvatarPreview character={identity.playerCharacter} scale={2} showLabels={false} />
              <span
                className="profession-facing-dot"
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
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="profession-stat">
                <span>{building.skillName}</span>
                <strong>
                  {level}/{maxLevel}
                </strong>
              </div>
              <div className="profession-stat">
                <span>经验</span>
                <strong>{experience}</strong>
              </div>
              <div className="profession-stat">
                <span>今日工资</span>
                <strong>{payCoins}</strong>
              </div>
              <div className="profession-stat">
                <span>时间</span>
                <strong>{workHoursLabel}</strong>
              </div>
            </div>
          </section>

          <section className="scene-card mt-5">
            <h3 className="text-2xl text-[#fec742]">{jobTitle}</h3>
            <p className="mt-1 text-sm leading-tight text-[#ead4aa]">{jobDescription}</p>
            <div className="profession-level-meter mt-4">
              <span style={{ width: `${Math.min(100, (level / maxLevel) * 100)}%` }} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="profession-unlock">
                <p className="text-sm text-[#ead4aa]">当前解锁</p>
                <strong>{currentUnlock}</strong>
              </div>
              <div className="profession-unlock">
                <p className="text-sm text-[#ead4aa]">下级目标</p>
                <strong>
                  {nextUnlock ? `${nextUnlock} / 还差 ${nextLevelXp} 经验` : '已满级'}
                </strong>
              </div>
            </div>
            <button
              className="observatory-control mt-4 w-full disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={registrationDisabled || !canReachPaper}
              onClick={requestRegistration}
            >
              {workedToday
                ? workedHereToday
                  ? `今天已在${building.buildingName}做过一天工`
                  : '今天已在别处打工'
                : canReachPaper
                  ? '查看报名纸'
                  : '走到接待桌前'}
            </button>
          </section>
        </main>

        <aside className="scene-sidebar">
          <h3 className="font-display text-4xl leading-none text-[#fec742]">报名说明</h3>
          <div className="mt-4 flex flex-col gap-3 text-sm leading-tight text-[#ead4aa]">
            <p className="profession-note">走到接待桌前，对准桌上的白纸按 X。</p>
            <p className="profession-note">也可以在白纸上右键，确认后开始今日临时工。</p>
            <p className="profession-note">一天只能做一份工，睡觉存档后进入下一天。</p>
            <p className="profession-note">
              {building.skillName}共 10 级，后续会逐级解锁可制作物和经营权限。
            </p>
            {career?.workedToday && (
              <p className="profession-note profession-note-done">
                今日已做工：{career.lastWorkedProfessionLabel ?? '某职业'} /{' '}
                {career.lastWorkDateLabel ?? '今日'}
              </p>
            )}
          </div>
        </aside>
      </div>

      {confirmOpen && (
        <div className="profession-dialog-backdrop" role="presentation">
          <section className="profession-dialog" role="dialog" aria-modal="true">
            <h3 className="text-3xl text-[#fec742]">报名今日临时工？</h3>
            <p className="mt-3 text-sm leading-tight text-[#ead4aa]">
              今天在{building.buildingName}做 {workHoursLabel} 的{building.label}，获得 {payCoins}{' '}
              铜币和 {xpGain} 点经验。
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                className="observatory-control disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
                disabled={submitting}
                onClick={() => void confirmRegistration()}
              >
                确认报名
              </button>
              <button
                className="observatory-control"
                type="button"
                onClick={() => setConfirmOpen(false)}
              >
                先不报名
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

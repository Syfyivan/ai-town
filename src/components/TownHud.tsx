import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { usePlayerSettings } from '../hooks/usePlayerSettings';
import { useSessionIdentity } from '../hooks/useSessionIdentity';

type TownHudProps = {
  onOpenHelp: () => void;
  onOpenNpcManager: () => void;
  onOpenObservatory: () => void;
};

function splitCalendarLabel(label: string) {
  const match = label.match(/^(.*)\s(\d{2}:\d{2})$/);
  if (!match) {
    return { dateLabel: label, timeLabel: '09:00' };
  }
  return { dateLabel: match[1], timeLabel: match[2] };
}

export default function TownHud(props: TownHudProps) {
  const identity = useSessionIdentity();
  const settings = usePlayerSettings();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const status = useQuery(
    api.world.residentStatus,
    worldStatus?.worldId ? { worldId: worldStatus.worldId, sessionId: identity.sessionId } : 'skip',
  );

  const assets = status?.assets;
  const energy = assets?.energy ?? 100;
  const maxEnergy = assets?.maxEnergy ?? 100;
  const energyPercent = Math.max(0, Math.min(100, Math.floor((energy / maxEnergy) * 100)));
  const calendar = splitCalendarLabel(status?.calendar?.label ?? '溪山历 1月1日 09:00');
  const marketLabel = status?.market?.isOpen
    ? '集市开放'
    : `${status?.market?.daysUntilMarket ?? 14} 天后集市`;
  const playerName = status?.player?.name ?? identity.playerName;
  const food = assets?.food ?? 1;
  const coins = assets?.coins ?? 0;

  return (
    <div className="town-hud" aria-label="居民状态">
      <div className="town-hud-left">
        <section className="town-hud-panel town-hud-profile">
          <p>居民</p>
          <strong>{playerName}</strong>
          <span>{settings.movementMode === 'run' ? '默认跑步' : '默认步行'}</span>
        </section>
        <details className="town-hud-menu">
          <summary>菜单</summary>
          <div className="town-hud-menu-panel">
            <label>
              <span>移动</span>
              <select
                value={settings.movementMode}
                onChange={(event) =>
                  settings.setMovementMode(event.target.value === 'run' ? 'run' : 'walk')
                }
              >
                <option value="walk">默认走</option>
                <option value="run">默认跑</option>
              </select>
            </label>
            <button type="button" onClick={props.onOpenObservatory}>
              镇志
            </button>
            <button type="button" onClick={props.onOpenNpcManager}>
              NPC
            </button>
            <button type="button" onClick={props.onOpenHelp}>
              帮助
            </button>
          </div>
        </details>
      </div>

      <section className="town-hud-panel town-hud-status">
        <div>
          <p>{calendar.dateLabel}</p>
          <strong>{calendar.timeLabel}</strong>
        </div>
        <div className="town-hud-status-meta">
          <span>{marketLabel}</span>
          <span>铜币 {coins}</span>
          <span>食物 {food}</span>
        </div>
        <div className="town-hud-energy">
          <span>能量</span>
          <strong>
            {energy}/{maxEnergy}
          </strong>
          <div className="life-energy-bar">
            <i style={{ width: `${energyPercent}%` }} />
          </div>
        </div>
      </section>
    </div>
  );
}

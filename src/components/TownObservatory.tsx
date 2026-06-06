import { useQuery } from 'convex/react';
import { ReactNode } from 'react';
import ReactModal from 'react-modal';
import { api } from '../../convex/_generated/api';

type Props = {
  open: boolean;
  onClose: () => void;
};

function formatTime(timestamp?: number) {
  if (!timestamp) {
    return '';
  }
  return new Date(timestamp).toLocaleString();
}

function shortText(text?: string, maxLength = 90) {
  if (!text) {
    return '还没有消息';
  }
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export default function TownObservatory({ open, onClose }: Props) {
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const observatory = useQuery(
    api.world.townObservatory,
    open && worldStatus?.worldId ? { worldId: worldStatus.worldId } : 'skip',
  );

  return (
    <ReactModal
      isOpen={open}
      onRequestClose={onClose}
      style={modalStyles}
      contentLabel="镇志观察"
      ariaHideApp={false}
    >
      <div className="font-body text-white">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-5xl leading-none game-title">镇志观察</h2>
            <p className="mt-2 text-sm text-brown-200">{formatTime(Date.now())}</p>
          </div>
          <button className="observatory-control shrink-0" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        {!observatory && (
          <div className="border-4 border-brown-900 bg-brown-800 p-5 text-brown-100">
            正在整理镇志...
          </div>
        )}

        {observatory && (
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Metric label="居民" value={observatory.summary.residents} />
                <Metric label="真人" value={observatory.summary.humans} />
                <Metric label="对话" value={observatory.summary.archivedConversations} />
                <Metric label="反思" value={observatory.summary.reflections} />
              </div>

              <Panel title="当前活动">
                {observatory.activeActivities.length === 0 && <Empty>暂无活动</Empty>}
                {observatory.activeActivities.map((activity) => (
                  <div key={`${activity.player}-${activity.until}`} className="observatory-item">
                    <p className="text-brown-200">
                      {activity.emoji ? `${activity.emoji} ` : ''}
                      {activity.player}
                    </p>
                    <p>{activity.description}</p>
                    <time className="text-xs text-clay-100" dateTime={String(activity.until)}>
                      到 {formatTime(activity.until)}
                    </time>
                  </div>
                ))}
              </Panel>

              <Panel title="高频关系">
                {observatory.recurringPairs.length === 0 && <Empty>暂无关系记录</Empty>}
                {observatory.recurringPairs.map((pair) => (
                  <div key={pair.players.join('-')} className="observatory-item">
                    <p>{pair.players.join(' / ')}</p>
                    <p className="text-sm text-brown-200">已对话 {pair.count} 次</p>
                  </div>
                ))}
              </Panel>
            </section>

            <section className="space-y-4">
              <Panel title="最近对话">
                {observatory.conversations.length === 0 && <Empty>暂无对话</Empty>}
                {observatory.conversations.slice(0, 8).map((conversation) => (
                  <div key={conversation.id} className="observatory-item">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-brown-200">{conversation.participants.join(' / ')}</p>
                      <span className="text-xs text-clay-100">
                        {conversation.kind === 'active' ? '进行中' : formatTime(conversation.ended)}
                      </span>
                    </div>
                    <p className="mt-1 leading-snug">{shortText(conversation.latestMessage)}</p>
                    <p className="mt-1 text-xs text-clay-100">{conversation.numMessages} 条消息</p>
                  </div>
                ))}
              </Panel>

              <div className="grid gap-4 xl:grid-cols-2">
                <Panel title="重要记忆">
                  {observatory.importantMemories.length === 0 && <Empty>暂无记忆</Empty>}
                  {observatory.importantMemories.map((memory) => (
                    <MemoryItem key={memory.id} memory={memory} />
                  ))}
                </Panel>
                <Panel title="新近记忆">
                  {observatory.recentMemories.length === 0 && <Empty>暂无记忆</Empty>}
                  {observatory.recentMemories.map((memory) => (
                    <MemoryItem key={memory.id} memory={memory} />
                  ))}
                </Panel>
              </div>
            </section>
          </div>
        )}
      </div>
    </ReactModal>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-4 border-brown-900 bg-brown-800 p-3">
      <p className="text-sm text-brown-200">{label}</p>
      <p className="mt-1 font-display text-4xl leading-none text-white">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-4 border-brown-900 bg-brown-800 p-4">
      <h3 className="mb-3 font-display text-3xl leading-none text-brown-200">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-clay-100">{children}</p>;
}

function MemoryItem({
  memory,
}: {
  memory: {
    owner: string;
    description: string;
    importance: number;
    type: string;
    createdAt: number;
  };
}) {
  return (
    <div className="observatory-item">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-brown-200">{memory.owner}</p>
        <span className="text-xs text-clay-100">
          {memory.type} / {memory.importance.toFixed(1)}
        </span>
      </div>
      <p className="mt-1 leading-snug">{shortText(memory.description, 130)}</p>
      <time className="mt-1 block text-xs text-clay-100" dateTime={String(memory.createdAt)}>
        {formatTime(memory.createdAt)}
      </time>
    </div>
  );
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgb(0, 0, 0, 75%)',
    zIndex: 12,
  },
  content: {
    inset: '5vh 5vw auto 5vw',
    maxHeight: '90vh',
    border: '10px solid rgb(23, 20, 33)',
    borderRadius: '0',
    background: 'rgb(35, 38, 58)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
  },
};

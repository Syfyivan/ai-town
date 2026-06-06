import { useAction } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';

type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type VisualHotspot = {
  id: string;
  label: string;
  kind: string;
  rect: Rect;
  nextPrompt: string;
};

type VisualNode = {
  nodeId: string;
  parentNodeId?: string;
  title: string;
  prompt: string;
  depth: number;
  styleAnchor: string;
  imageStorageId?: string;
  imageUrl?: string;
  hotspots: VisualHotspot[];
};

type ParentNodePayload = {
  nodeId: string;
  title: string;
  prompt: string;
  depth: number;
  styleAnchor: string;
};

type LoadingState = {
  label: string;
  depth: number;
};

function makeSessionId() {
  if ('crypto' in window && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID();
  }
  return `visual-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toParentPayload(node: VisualNode): ParentNodePayload {
  return {
    nodeId: node.nodeId,
    title: node.title,
    prompt: node.prompt,
    depth: node.depth,
    styleAnchor: node.styleAnchor,
  };
}

export default function CinemaOverlay(props: { open: boolean; onClose: () => void }) {
  const generateNextNode = useAction(api.visuals.generateNextNode);
  const [sessionId] = useState(makeSessionId);
  const [nodes, setNodes] = useState<VisualNode[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>();
  const [error, setError] = useState<string>();
  const overlayRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const currentNode = nodes[nodes.length - 1];
  const recentNodes = useMemo(() => nodes.slice(-6).reverse(), [nodes]);
  const loading = loadingState !== undefined;

  const loadNode = useCallback(
    async (parent?: VisualNode, hotspot?: VisualHotspot) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setError(undefined);
      setLoadingState({
        label: hotspot ? `沿着「${hotspot.label}」继续生成` : '生成溪山镇全景',
        depth: parent ? parent.depth + 1 : 0,
      });

      try {
        const nextNode = (await generateNextNode({
          sessionId,
          parent: parent ? toParentPayload(parent) : undefined,
          hotspot,
        })) as VisualNode;
        if (requestIdRef.current !== requestId) {
          return;
        }
        setNodes((currentNodes) => (parent && hotspot ? [...currentNodes, nextNode] : [nextNode]));
      } catch (loadError) {
        if (requestIdRef.current !== requestId) {
          return;
        }
        console.error('Failed to generate visual node', loadError);
        setError(loadError instanceof Error ? loadError.message : '生成失败，请稍后重试');
      } finally {
        if (requestIdRef.current === requestId) {
          setLoadingState(undefined);
        }
      }
    },
    [generateNextNode, sessionId],
  );

  useEffect(() => {
    if (!props.open || nodes.length > 0 || loading) {
      return;
    }
    void loadNode();
  }, [loadNode, loading, nodes.length, props.open]);

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

  if (!props.open) {
    return null;
  }

  const close = () => {
    requestIdRef.current += 1;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    }
    props.onClose();
  };

  const requestSystemFullscreen = () => {
    if (!document.fullscreenElement) {
      void overlayRef.current?.requestFullscreen();
    }
  };

  const retryCurrent = () => {
    if (currentNode) {
      setError(undefined);
      return;
    }
    void loadNode();
  };

  const resetFilm = () => {
    requestIdRef.current += 1;
    setNodes([]);
    setError(undefined);
    setLoadingState(undefined);
    window.setTimeout(() => void loadNode(), 0);
  };

  const goBack = () => {
    if (loading) {
      return;
    }
    setNodes((currentNodes) =>
      currentNodes.length > 1 ? currentNodes.slice(0, currentNodes.length - 1) : currentNodes,
    );
  };

  const followHotspot = (hotspot: VisualHotspot) => {
    if (!currentNode || loading) {
      return;
    }
    void loadNode(currentNode, hotspot);
  };

  return (
    <div
      className="fixed inset-0 z-50 w-screen max-w-[100vw] overflow-hidden bg-[#070812] text-white font-body"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="溪山电影院"
    >
      <div className="absolute inset-0 cinema-ambient" />
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden px-6 py-5">
        <header className="flex w-full min-w-0 shrink-0 items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-5xl leading-none game-title">无限银幕</h2>
            <p className="mt-1 truncate text-base text-brown-200">
              {currentNode
                ? `${currentNode.title} / 第 ${currentNode.depth + 1} 层`
                : '正在准备溪山镇的第一帧'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="cinema-control disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              onClick={goBack}
              disabled={nodes.length <= 1 || loading}
              title="返回上一层"
            >
              回退
            </button>
            <button
              className="cinema-control disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              onClick={resetFilm}
              disabled={loading}
              title="重新生成小镇全景"
            >
              重映
            </button>
            <button
              className="cinema-control"
              type="button"
              onClick={requestSystemFullscreen}
              title="进入系统全屏"
            >
              全屏
            </button>
            <button className="cinema-control" type="button" onClick={close} title="离开影院">
              离场
            </button>
          </div>
        </header>

        <div className="mt-4 grid min-h-0 w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="min-h-0 min-w-0">
            <div className="cinema-screen relative h-full min-h-[560px] overflow-hidden border-[10px] border-[#181425] bg-black shadow-2xl">
              {currentNode?.imageUrl ? (
                <img
                  alt={currentNode.title}
                  className="block h-full w-full select-none object-cover"
                  draggable={false}
                  src={currentNode.imageUrl}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#101322]">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#fec742] border-t-transparent" />
                </div>
              )}

              {currentNode?.hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  className="group absolute border-2 border-[#fec742]/75 bg-[#181425]/10 text-left shadow-[0_0_0_9999px_rgba(0,0,0,0)] transition hover:border-[#fff7d6] hover:bg-[#fec742]/20 focus:outline-none focus:ring-4 focus:ring-[#5acde8]/70 disabled:cursor-wait disabled:opacity-50"
                  style={{
                    left: `${hotspot.rect.x * 100}%`,
                    top: `${hotspot.rect.y * 100}%`,
                    width: `${hotspot.rect.w * 100}%`,
                    height: `${hotspot.rect.h * 100}%`,
                  }}
                  type="button"
                  disabled={loading}
                  onClick={() => followHotspot(hotspot)}
                  title={hotspot.nextPrompt}
                >
                  <span className="absolute left-2 top-2 max-w-[calc(100%-1rem)] truncate bg-[#181425]/85 px-2 py-1 text-sm text-[#fff7d6] opacity-95 shadow">
                    {hotspot.label}
                  </span>
                </button>
              ))}

              {loadingState && (
                <div className="absolute inset-0 flex items-end justify-center bg-[#f7efd9]/70 p-8 text-[#3b3128] backdrop-blur-sm">
                  <div className="w-[520px] max-w-full border-4 border-[#181425]/15 bg-[#fffaf1]/95 p-5 shadow-2xl">
                    <div className="mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#181425] border-t-transparent" />
                    <p className="text-2xl font-bold leading-tight">{loadingState.label}...</p>
                    <p className="mt-2 text-sm opacity-75">Building visual node depth {loadingState.depth + 1}</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-x-6 bottom-6 border-4 border-[#dd7c42] bg-[#181425]/95 p-4 text-white">
                  <p className="text-lg font-bold">这一帧没生成出来</p>
                  <p className="mt-1 text-sm text-brown-100">{error}</p>
                  <button className="cinema-replay mt-3" type="button" onClick={retryCurrent}>
                    重试
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside className="min-h-0 overflow-y-auto overflow-x-hidden border-l-4 border-[#181425] bg-[#181425]/80 p-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-[#fec742]">Semantic path</p>
              <h3 className="mt-2 text-2xl leading-tight text-white">
                {currentNode ? currentNode.title : '溪山镇全景'}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-brown-100">
                {currentNode
                  ? currentNode.prompt
                  : '第一帧会建立小镇全景和可继续延伸的语义热区。'}
              </p>
            </div>

            <div className="mt-5">
              <p className="text-sm uppercase tracking-[0.18em] text-[#fec742]">Hotspots</p>
              <div className="mt-2 space-y-2">
                {currentNode?.hotspots.map((hotspot) => (
                  <button
                    key={hotspot.id}
                    className="cinema-film-button w-full text-left disabled:cursor-wait disabled:opacity-50"
                    type="button"
                    disabled={loading}
                    onClick={() => followHotspot(hotspot)}
                    title={hotspot.nextPrompt}
                  >
                    {hotspot.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="text-sm uppercase tracking-[0.18em] text-[#fec742]">History</p>
              <div className="mt-2 space-y-2">
                {recentNodes.map((node) => (
                  <div key={node.nodeId} className="border-l-4 border-[#fec742] bg-black/20 px-3 py-2">
                    <p className="text-sm text-brown-100">
                      {node.depth + 1}. {node.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

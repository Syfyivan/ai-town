import { useAction } from 'convex/react';
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

export default function SpyglassOverlay(props: { open: boolean; onClose: () => void }) {
  const generateNextNode = useAction(api.visuals.generateNextNode);
  const resolveClick = useAction(api.visuals.resolveClick);
  const [sessionId] = useState(makeSessionId);
  const [nodes, setNodes] = useState<VisualNode[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>();
  const [error, setError] = useState<string>();
  const [resolving, setResolving] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const currentNode = nodes[nodes.length - 1];
  const recentNodes = useMemo(() => nodes.slice(-6).reverse(), [nodes]);
  const loading = loadingState !== undefined;
  const busy = loading || resolving;

  const loadNode = useCallback(
    async (parent?: VisualNode, hotspot?: VisualHotspot, subject?: string) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      setError(undefined);
      setLoadingState({
        label: subject
          ? `沿着「${subject}」继续放大`
          : hotspot
            ? `沿着「${hotspot.label}」继续放大`
            : '正在观测溪山镇全景',
        depth: parent ? parent.depth + 1 : 0,
      });

      try {
        const nextNode = (await generateNextNode({
          sessionId,
          parent: parent ? toParentPayload(parent) : undefined,
          hotspot,
          subject,
        })) as VisualNode;
        if (requestIdRef.current !== requestId) {
          return;
        }
        setNodes((currentNodes) =>
          parent && (hotspot || subject) ? [...currentNodes, nextNode] : [nextNode],
        );
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

  const resetView = () => {
    requestIdRef.current += 1;
    setNodes([]);
    setError(undefined);
    setLoadingState(undefined);
    window.setTimeout(() => void loadNode(), 0);
  };

  const goBack = () => {
    if (busy) {
      return;
    }
    setNodes((currentNodes) =>
      currentNodes.length > 1 ? currentNodes.slice(0, currentNodes.length - 1) : currentNodes,
    );
  };

  const followHotspot = (hotspot: VisualHotspot) => {
    if (!currentNode || busy) {
      return;
    }
    void loadNode(currentNode, hotspot);
  };

  // True-Flipbook path: click anywhere on the frame, let the vision model say what
  // is there, then zoom into that subject. Falls back to the suggested points when
  // no vision model is configured (VISION_API_URL unset).
  const onFrameClick = async (event: MouseEvent<HTMLImageElement>) => {
    if (!currentNode?.imageUrl || busy) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setError(undefined);
    setResolving(true);
    try {
      const result = await resolveClick({
        imageUrl: currentNode.imageUrl,
        x,
        y,
        title: currentNode.title,
        path: nodes.map((node) => node.title),
      });
      if (result?.subject) {
        void loadNode(currentNode, undefined, result.subject);
      } else {
        setError(
          '望远镜还没接入视觉模型（后端未配置 VISION_API_URL）。先用右侧的「建议观测点」继续探索。',
        );
      }
    } catch (resolveError) {
      console.error('Failed to resolve click', resolveError);
      setError(resolveError instanceof Error ? resolveError.message : '解析点击失败，请重试');
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 w-screen max-w-[100vw] overflow-hidden bg-[#070812] text-white font-body"
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="溪山观景台"
    >
      <div className="absolute inset-0 cinema-ambient" />
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden px-6 py-5">
        <header className="flex w-full min-w-0 shrink-0 items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-5xl leading-none game-title">溪山观景台</h2>
            <p className="mt-1 truncate text-base text-brown-200">
              {currentNode
                ? `${currentNode.title} / 第 ${currentNode.depth + 1} 层 · 点画面任意处看得更近`
                : '正在架起望远镜，观测溪山镇'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="cinema-control disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              onClick={goBack}
              disabled={nodes.length <= 1 || busy}
              title="拉远一层"
            >
              拉远
            </button>
            <button
              className="cinema-control disabled:cursor-not-allowed disabled:opacity-45"
              type="button"
              onClick={resetView}
              disabled={busy}
              title="重新观测小镇全景"
            >
              重新观测
            </button>
            <button
              className="cinema-control"
              type="button"
              onClick={requestSystemFullscreen}
              title="进入系统全屏"
            >
              全屏
            </button>
            <button className="cinema-control" type="button" onClick={close} title="收起望远镜">
              收起
            </button>
          </div>
        </header>

        <div className="mt-4 grid min-h-0 w-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)_320px] gap-4">
          <div className="min-h-0 min-w-0">
            <div className="cinema-screen relative h-full min-h-[560px] overflow-hidden border-[10px] border-[#181425] bg-black shadow-2xl">
              {currentNode?.imageUrl ? (
                <img
                  alt={currentNode.title}
                  className="block h-full w-full cursor-zoom-in select-none object-cover"
                  draggable={false}
                  src={currentNode.imageUrl}
                  onClick={(event) => void onFrameClick(event)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#101322]">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#fec742] border-t-transparent" />
                </div>
              )}

              {/* Telescope viewfinder vignette — purely decorative, lets clicks pass through. */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  boxShadow: 'inset 0 0 180px 60px rgba(7,8,18,0.85)',
                  borderRadius: '40%',
                }}
              />

              {resolving && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#5acde8]/80 bg-[#070812]/70 px-4 py-2 text-sm text-[#cfeffb]">
                  正在辨认你点的位置…
                </div>
              )}

              {loadingState && (
                <div className="absolute inset-0 flex items-end justify-center bg-[#f7efd9]/70 p-8 text-[#3b3128] backdrop-blur-sm">
                  <div className="w-[520px] max-w-full border-4 border-[#181425]/15 bg-[#fffaf1]/95 p-5 shadow-2xl">
                    <div className="mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#181425] border-t-transparent" />
                    <p className="text-2xl font-bold leading-tight">{loadingState.label}...</p>
                    <p className="mt-2 text-sm opacity-75">
                      Building visual node depth {loadingState.depth + 1}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="absolute inset-x-6 bottom-6 border-4 border-[#dd7c42] bg-[#181425]/95 p-4 text-white">
                  <p className="text-lg font-bold">这一帧没看清</p>
                  <p className="mt-1 text-sm text-brown-100">{error}</p>
                  <button className="cinema-replay mt-3" type="button" onClick={retryCurrent}>
                    知道了
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
                  : '第一帧会观测小镇的真实全景，反映此刻镇民正在做的事。'}
              </p>
            </div>

            <div className="mt-5">
              <p className="text-sm uppercase tracking-[0.18em] text-[#fec742]">建议观测点</p>
              <p className="mt-1 text-xs text-brown-200">
                接入视觉模型后，直接点画面任意处即可放大；这里是兜底的快捷探索点。
              </p>
              <div className="mt-2 space-y-2">
                {currentNode?.hotspots.map((hotspot) => (
                  <button
                    key={hotspot.id}
                    className="cinema-film-button w-full text-left disabled:cursor-wait disabled:opacity-50"
                    type="button"
                    disabled={busy}
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
                  <div
                    key={node.nodeId}
                    className="border-l-4 border-[#fec742] bg-black/20 px-3 py-2"
                  >
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

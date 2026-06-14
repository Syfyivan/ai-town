import Game from './components/Game.tsx';

import { ToastContainer } from 'react-toastify';
import a16zImg from '../assets/a16z.png';
import convexImg from '../assets/convex.svg';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useState } from 'react';
import ReactModal from 'react-modal';
import MusicButton from './components/buttons/MusicButton.tsx';
import InteractButton from './components/buttons/InteractButton.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';
import PoweredByConvex from './components/PoweredByConvex.tsx';
import SpyglassOverlay from './components/SpyglassOverlay.tsx';
import TownObservatory from './components/TownObservatory.tsx';
import NpcManagerModal from './components/NpcManagerModal.tsx';
import ArtStudioOverlay from './components/ArtStudioOverlay.tsx';
import GardenOverlay from './components/GardenOverlay.tsx';
import { useResidentPresence } from './hooks/useResidentPresence.ts';
import ProfessionWorkOverlay from './components/ProfessionWorkOverlay.tsx';
import { ProfessionId } from './components/professionCatalog.ts';
import TownHud from './components/TownHud.tsx';

type TownScene = 'town' | 'studio' | 'garden' | 'profession';

export default function Home() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [spyglassOpen, setSpyglassOpen] = useState(() =>
    new URLSearchParams(window.location.search).has('spyglass'),
  );
  const [observatoryOpen, setObservatoryOpen] = useState(false);
  const [npcManagerOpen, setNpcManagerOpen] = useState(false);
  const [scene, setScene] = useState<TownScene>('town');
  const [professionScene, setProfessionScene] = useState<ProfessionId>('carpenter');
  const { isResident } = useResidentPresence();
  const residentGameMode = isResident;
  const townIsImmersive = scene === 'town' && residentGameMode;
  const openProfession = (profession: ProfessionId) => {
    setProfessionScene(profession);
    setScene('profession');
  };
  return (
    <main className="town-root relative flex min-h-screen flex-col items-center justify-between font-body game-background">
      {!townIsImmersive && scene === 'town' && <PoweredByConvex />}
      <SpyglassOverlay open={spyglassOpen} onClose={() => setSpyglassOpen(false)} />
      <TownObservatory open={observatoryOpen} onClose={() => setObservatoryOpen(false)} />
      <NpcManagerModal open={npcManagerOpen} onClose={() => setNpcManagerOpen(false)} />

      <ReactModal
        isOpen={helpModalOpen}
        onRequestClose={() => setHelpModalOpen(false)}
        style={modalStyles}
        contentLabel="Help modal"
        ariaHideApp={false}
      >
        <div className="font-body">
          <h1 className="text-center text-6xl font-bold font-display game-title">帮助</h1>
          <p>
            欢迎来到溪山镇。你可以作为居民住进小镇，移动、聊天、打工、种菜，也能顺手观察 AI
            镇民的日常。
          </p>
          <h2 className="text-4xl mt-4">生活</h2>
          <p>
            点击互动按钮后，你会以自己的居民身份进入地图。居民模式会放大小镇地图，角色详情会在需要时浮出。
          </p>
          <h2 className="text-4xl mt-4">镇民</h2>
          <p>拖拽地图可以移动视角，滚轮可以缩放。点击任意角色，可以查看他的介绍和最近对话。</p>
          <p className="text-2xl mt-2">操作</p>
          <p className="mt-4">点击地图可以移动你的角色。</p>
          <p className="mt-4">
            也可以用 WASD 或方向键移动；沿着小路走到农场路口后继续向前，或按 X
            进入小菜园。靠近画室、观景台和职业建筑门口时按 X 进入，按 Z
            停止移动或取消查看。进入画室后，WASD 移动到工作站，X
            开工或领取工资。进入菜园后，WASD 在田里移动，X 播种、浇水或收获，Z
            切换种子。进入木作坊、铁铺、星井小塔或酒馆后，走到接待桌前按
            X，或右键桌上的白纸，确认报名 10:00-18:00 的一天临时工。
          </p>
          <p className="mt-4">
            想和某个角色聊天时，先点击角色，再点击“开始对话”。对方会走向你，距离足够近时对话会自动开始。
            你可以随时离开对话；智能体也可能主动邀请你聊天。
          </p>
          <p className="mt-4">
            当前最多支持 {MAX_HUMAN_PLAYERS} 名真人玩家同时加入。空闲五分钟后，你会自动离开模拟。
          </p>
        </div>
      </ReactModal>
      {/*<div className="p-3 absolute top-0 right-0 z-10 text-2xl">
        <Authenticated>
          <UserButton afterSignOutUrl="/ai-town" />
        </Authenticated>

        <Unauthenticated>
          <LoginButton />
        </Unauthenticated>
      </div> */}

      <div className={`town-app-shell ${residentGameMode ? 'town-app-shell-resident' : ''}`}>
        {scene === 'town' && !townIsImmersive && (
          <>
            <header className="town-hero">
              <h1 className="town-hero-title game-title">溪山镇</h1>
              <p className="town-hero-subtitle shadow-solid">
                一个中文 AI 小镇，角色会闲逛、聊天、记住彼此的故事。
                {/* <Unauthenticated>
            <div className="my-1.5 sm:my-0" />
            Log in to join the town
            <br className="block sm:hidden" /> and the conversation!
          </Unauthenticated> */}
              </p>
            </header>
          </>
        )}

        {scene === 'town' && !spyglassOpen && (
          <Game
            immersive={townIsImmersive}
            onOpenSpyglass={() => setSpyglassOpen(true)}
            onOpenArtStudio={() => setScene('studio')}
            onOpenGarden={() => setScene('garden')}
            onOpenProfession={openProfession}
          />
        )}
        {townIsImmersive && (
          <TownHud
            onOpenHelp={() => setHelpModalOpen(true)}
            onOpenNpcManager={() => setNpcManagerOpen(true)}
            onOpenObservatory={() => setObservatoryOpen(true)}
          />
        )}

        {scene === 'studio' && <ArtStudioOverlay open onClose={() => setScene('town')} />}
        {scene === 'garden' && <GardenOverlay open onClose={() => setScene('town')} />}
        {scene === 'profession' && (
          <ProfessionWorkOverlay
            open
            profession={professionScene}
            onClose={() => setScene('town')}
          />
        )}

        {scene === 'town' && !townIsImmersive && (
          <footer className="town-footer">
            <div className="town-footer-controls">
              <FreezeButton />
              <MusicButton />
              <InteractButton />
              <details className="town-system-menu">
                <summary>菜单</summary>
                <div className="town-system-menu-panel">
                  <button type="button" onClick={() => setObservatoryOpen(true)}>
                    镇志
                  </button>
                  <button type="button" onClick={() => setNpcManagerOpen(true)}>
                    NPC
                  </button>
                  <button type="button" onClick={() => setHelpModalOpen(true)}>
                    帮助
                  </button>
                  <a href="https://github.com/a16z-infra/ai-town">上游代码</a>
                </div>
              </details>
            </div>
            <div className="town-footer-brands">
              <a href="https://a16z.com">
                <img className="w-8 h-8 pointer-events-auto" src={a16zImg} alt="a16z" />
              </a>
              <a href="https://convex.dev/c/ai-town">
                <img className="w-20 h-8 pointer-events-auto" src={convexImg} alt="Convex" />
              </a>
            </div>
          </footer>
        )}
        <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
      </div>
    </main>
  );
}

const modalStyles = {
  overlay: {
    backgroundColor: 'rgb(0, 0, 0, 75%)',
    zIndex: 12,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: '50%',

    border: '10px solid rgb(23, 20, 33)',
    borderRadius: '0',
    background: 'rgb(35, 38, 58)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
  },
};

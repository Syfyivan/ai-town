import Game from './components/Game.tsx';

import { ToastContainer } from 'react-toastify';
import a16zImg from '../assets/a16z.png';
import convexImg from '../assets/convex.svg';
import starImg from '../assets/star.svg';
import helpImg from '../assets/help.svg';
import cinemaImg from '../assets/cinema.svg';
// import { UserButton } from '@clerk/clerk-react';
// import { Authenticated, Unauthenticated } from 'convex/react';
// import LoginButton from './components/buttons/LoginButton.tsx';
import { useState } from 'react';
import ReactModal from 'react-modal';
import MusicButton from './components/buttons/MusicButton.tsx';
import Button from './components/buttons/Button.tsx';
import InteractButton from './components/buttons/InteractButton.tsx';
import FreezeButton from './components/FreezeButton.tsx';
import { MAX_HUMAN_PLAYERS } from '../convex/constants.ts';
import PoweredByConvex from './components/PoweredByConvex.tsx';
import CinemaOverlay from './components/CinemaOverlay.tsx';
import TownObservatory from './components/TownObservatory.tsx';
import NpcManagerModal from './components/NpcManagerModal.tsx';
import ArtStudioOverlay from './components/ArtStudioOverlay.tsx';
import GardenOverlay from './components/GardenOverlay.tsx';

export default function Home() {
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [cinemaOpen, setCinemaOpen] = useState(() =>
    new URLSearchParams(window.location.search).has('cinema'),
  );
  const [observatoryOpen, setObservatoryOpen] = useState(false);
  const [npcManagerOpen, setNpcManagerOpen] = useState(false);
  const [artStudioOpen, setArtStudioOpen] = useState(false);
  const [gardenOpen, setGardenOpen] = useState(false);
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between font-body game-background">
      <PoweredByConvex />
      <CinemaOverlay open={cinemaOpen} onClose={() => setCinemaOpen(false)} />
      <ArtStudioOverlay open={artStudioOpen} onClose={() => setArtStudioOpen(false)} />
      <GardenOverlay open={gardenOpen} onClose={() => setGardenOpen(false)} />
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
          <p>欢迎来到溪山镇。这里既可以作为旁观者观察智能体生活，也可以加入小镇和他们直接对话。</p>
          <h2 className="text-4xl mt-4">观察</h2>
          <p>拖拽地图可以移动视角，滚轮可以缩放。点击任意角色，可以查看他的介绍和最近对话。</p>
          <h2 className="text-4xl mt-4">互动</h2>
          <p>点击互动按钮后，你会以“访客”身份进入地图。选择一个角色后，可以邀请对方聊天。</p>
          <p className="text-2xl mt-2">操作</p>
          <p className="mt-4">点击地图可以移动你的角色。</p>
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

      <div className="w-full lg:h-screen min-h-screen relative isolate overflow-hidden lg:p-8 shadow-2xl flex flex-col justify-start">
        <h1 className="mx-auto text-4xl p-3 sm:text-8xl lg:text-9xl font-bold font-display leading-none tracking-wide game-title w-full text-left sm:text-center sm:w-auto">
          溪山镇
        </h1>

        <div className="max-w-xs md:max-w-xl lg:max-w-none mx-auto my-4 text-center text-base sm:text-xl md:text-2xl text-white leading-tight shadow-solid">
          一个中文 AI 小镇，角色会闲逛、聊天、记住彼此的故事。
          {/* <Unauthenticated>
            <div className="my-1.5 sm:my-0" />
            Log in to join the town
            <br className="block sm:hidden" /> and the conversation!
          </Unauthenticated> */}
        </div>

        {!cinemaOpen && (
          <Game
            onOpenCinema={() => setCinemaOpen(true)}
            onOpenArtStudio={() => setArtStudioOpen(true)}
            onOpenGarden={() => setGardenOpen(true)}
          />
        )}

        <footer className="justify-end bottom-0 left-0 w-full flex items-center mt-4 gap-3 p-6 flex-wrap pointer-events-none">
          <div className="flex gap-4 flex-grow pointer-events-none">
            <FreezeButton />
            <MusicButton />
            <Button href="https://github.com/a16z-infra/ai-town" imgUrl={starImg}>
              上游
            </Button>
            <Button imgUrl={cinemaImg} onClick={() => setCinemaOpen(true)}>
              影院
            </Button>
            <Button imgUrl={starImg} onClick={() => setArtStudioOpen(true)}>
              画室
            </Button>
            <Button imgUrl={starImg} onClick={() => setGardenOpen(true)}>
              菜园
            </Button>
            <Button imgUrl={starImg} onClick={() => setObservatoryOpen(true)}>
              镇志
            </Button>
            <Button imgUrl={starImg} onClick={() => setNpcManagerOpen(true)}>
              NPC
            </Button>
            <InteractButton />
            <Button imgUrl={helpImg} onClick={() => setHelpModalOpen(true)}>
              帮助
            </Button>
          </div>
          <a href="https://a16z.com">
            <img className="w-8 h-8 pointer-events-auto" src={a16zImg} alt="a16z" />
          </a>
          <a href="https://convex.dev/c/ai-town">
            <img className="w-20 h-8 pointer-events-auto" src={convexImg} alt="Convex" />
          </a>
        </footer>
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

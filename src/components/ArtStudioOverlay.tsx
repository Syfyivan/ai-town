const PAINTERS_GUILD_SRC = '/ai-town/painters-guild/index.html';

export default function ArtStudioOverlay(props: { open: boolean; onClose: () => void }) {
  if (!props.open) {
    return null;
  }

  return (
    <section
      className="scene-page scene-page-studio painters-guild-scene text-white"
      aria-label="溪山画家工会"
    >
      <header className="scene-header painters-guild-header">
        <div>
          <h2 className="font-display text-5xl leading-none game-title">溪山画家工会</h2>
          <p className="mt-1 text-base text-[#ead4aa]">老板 顾南星 / 学徒日班开放中</p>
        </div>
        <button className="observatory-control" type="button" onClick={props.onClose}>
          返回小镇
        </button>
      </header>

      <div className="painters-guild-frame-shell">
        <iframe
          className="painters-guild-frame"
          src={PAINTERS_GUILD_SRC}
          title="画家工会"
          scrolling="no"
        />
      </div>
    </section>
  );
}

import { CSSProperties } from 'react';
import { getCharacterAppearance } from '../../data/characters';

const SPRITE_SHEET_WIDTH = 384;
const SPRITE_SHEET_HEIGHT = 256;

export default function AvatarPreview({
  character,
  scale = 3,
  showLabels = true,
}: {
  character: string;
  scale?: number;
  showLabels?: boolean;
}) {
  const appearance = getCharacterAppearance(character) ?? getCharacterAppearance('f1');
  if (!appearance) {
    return null;
  }

  const frame = appearance.spritesheetData.frames.down.frame;
  const previewStyle: CSSProperties = {
    width: frame.w * scale,
    height: frame.h * scale,
    backgroundImage: `url(${appearance.textureUrl})`,
    backgroundPosition: `${-frame.x * scale}px ${-frame.y * scale}px`,
    backgroundSize: `${SPRITE_SHEET_WIDTH * scale}px ${SPRITE_SHEET_HEIGHT * scale}px`,
  };

  return (
    <div className="avatar-preview">
      <div className="avatar-preview-sprite" style={previewStyle} aria-hidden="true" />
      {showLabels && (
        <div className="min-w-0">
          <p className="avatar-preview-name">{appearance.label}</p>
          <p className="avatar-preview-meta">
            {appearance.hair} / {appearance.outfit}
          </p>
        </div>
      )}
    </div>
  );
}

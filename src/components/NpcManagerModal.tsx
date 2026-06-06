import { useConvex, useMutation, useQuery } from 'convex/react';
import { FormEvent, useMemo, useState } from 'react';
import ReactModal from 'react-modal';
import { toast } from 'react-toastify';
import { api } from '../../convex/_generated/api';
import { waitForInput } from '../hooks/sendInput';

type Props = {
  open: boolean;
  onClose: () => void;
};

const CHARACTER_OPTIONS = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];

const INITIAL_FORM = {
  name: '陆青',
  character: 'f2',
  identity:
    '陆青是溪山镇新来的种子商人，爽朗、细心，熟悉作物和季节。他很想知道镇民真正需要什么，也会悄悄记下谁适合收到哪种种子。',
  plan: '你想认识镇上的居民，并找到一个愿意一起照看小菜园的人。',
};

export default function NpcManagerModal({ open, onClose }: Props) {
  const convex = useConvex();
  const worldStatus = useQuery(api.world.defaultWorldStatus);
  const addNpc = useMutation(api.world.addNpc);
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const trimmedName = form.name.trim();
  const canSubmit = useMemo(
    () =>
      !!worldStatus?.worldId &&
      trimmedName.length > 0 &&
      form.identity.trim().length > 0 &&
      form.plan.trim().length > 0 &&
      !submitting,
    [form.identity, form.plan, submitting, trimmedName.length, worldStatus?.worldId],
  );

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!worldStatus?.worldId || !canSubmit) {
      return;
    }
    setSubmitting(true);
    try {
      const inputId = await addNpc({
        worldId: worldStatus.worldId,
        name: form.name,
        character: form.character,
        identity: form.identity,
        plan: form.plan,
      });
      await waitForInput(convex, inputId);
      toast.success(`${trimmedName} 已加入溪山镇`);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ReactModal
      isOpen={open}
      onRequestClose={onClose}
      style={modalStyles}
      contentLabel="添加 NPC"
      ariaHideApp={false}
    >
      <form className="font-body text-white" onSubmit={(event) => void submit(event)}>
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-5xl leading-none game-title">添加居民</h2>
            <p className="mt-2 text-sm text-brown-200">创建后会进入当前世界，并参与闲逛、对话和记忆。</p>
          </div>
          <button className="observatory-control shrink-0" type="button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
          <label className="npc-field">
            <span>名字</span>
            <input
              maxLength={16}
              type="text"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </label>

          <label className="npc-field">
            <span>外观</span>
            <select
              value={form.character}
              onChange={(event) => updateField('character', event.target.value)}
            >
              {CHARACTER_OPTIONS.map((character) => (
                <option key={character} value={character}>
                  {character}
                </option>
              ))}
            </select>
          </label>

          <label className="npc-field md:col-span-2">
            <span>人设</span>
            <textarea
              maxLength={500}
              rows={5}
              value={form.identity}
              onChange={(event) => updateField('identity', event.target.value)}
            />
          </label>

          <label className="npc-field md:col-span-2">
            <span>当前目标</span>
            <textarea
              maxLength={220}
              rows={3}
              value={form.plan}
              onChange={(event) => updateField('plan', event.target.value)}
            />
          </label>
        </div>

        <footer className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-brown-200">
            {worldStatus?.worldId ? '会添加到当前默认小镇。' : '小镇还没有准备好。'}
          </p>
          <button className="observatory-control" disabled={!canSubmit} type="submit">
            {submitting ? '加入中...' : '加入小镇'}
          </button>
        </footer>
      </form>
    </ReactModal>
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
    width: 'min(760px, 90vw)',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '10px solid rgb(23, 20, 33)',
    borderRadius: '0',
    background: 'rgb(35, 38, 58)',
    color: 'white',
    fontFamily: '"Upheaval Pro", "sans-serif"',
  },
};

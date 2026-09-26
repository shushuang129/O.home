'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getSetting, onSettingChange, setSetting } from '@/lib/settingStore';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { newId } from '@/lib/postStore';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';

type RoomItem = {
  id: string; imgId: string; x: number; y: number; w: number; h: number;
  rot: number; z: number; link?: string;
};
type RoomState = { background?: string; items: RoomItem[] };
type StickerLibraryItem = { id: string; imgId: string; name?: string };
const KEY = 'ohome.room.v1';
const STICKER_KEY = 'ohome.room.stickers.v1';
const DEFAULT: RoomState = { items: [] };
const DEFAULT_STICKERS: StickerLibraryItem[] = [];

function readRoom(): RoomState {
  try {
    const v = getSetting<RoomState>(KEY, DEFAULT);
    return { ...DEFAULT, ...v, items: Array.isArray(v?.items) ? v.items : [] };
  } catch { return DEFAULT; }
}

function StickerLibraryCard({ sticker, onAdd, onRemove }: { sticker: StickerLibraryItem; onAdd: () => void; onRemove: () => void }) {
  const src = useBlobUrl(sticker.imgId);
  if (!src) return null;
  return <div style={{ border:'1px solid var(--line)', borderRadius:12, padding:7, background:'var(--bg)' }}>
    <div style={{ height:86, borderRadius:8, overflow:'hidden', display:'grid', placeItems:'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={sticker.name ?? '스티커'} draggable={false} style={{ width:'100%', height:'100%', objectFit:'contain' }} />
    </div>
    <div style={{ display:'flex', gap:5, marginTop:6 }}>
      <button type="button" className="btn btn-dark" onClick={onAdd} style={{ flex:1, padding:'6px 4px', fontSize:11, borderRadius:8 }}>＋ 넣기</button>
      <button type="button" className="btn btn-ghost" onClick={onRemove} style={{ padding:'6px 8px', fontSize:11, borderRadius:8 }} title="보관함에서 삭제">×</button>
    </div>
  </div>;
}

function RoomImage({ id, selected, editOn, onSelect, onMove, onResize, onRotate, onOpen }: {
  id: string; selected: boolean; editOn: boolean; onSelect: () => void;
  onMove: (dx: number, dy: number) => void; onResize: (dw: number, dh: number) => void;
  onRotate: (deg: number) => void; onOpen: () => void;
}) {
  const src = useBlobUrl(id);
  const drag = useRef<{ x: number; y: number; mode: 'move' | 'resize' } | null>(null);

  const down = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    if (!editOn || e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, mode };
    const move = (ev: PointerEvent) => {
      const d = drag.current; if (!d) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      drag.current = { x: ev.clientX, y: ev.clientY, mode: d.mode };
      if (d.mode === 'move') onMove(dx, dy); else onResize(dx, dy);
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (!src) return null;
  return (
    <div onPointerDown={e => down(e, 'move')}
      onClick={e => { e.stopPropagation(); if (!editOn) onOpen(); else onSelect(); }}
      style={{ width: '100%', height: '100%', cursor: editOn ? 'grab' : 'pointer', touchAction: 'none' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
      {editOn && selected && (
        <>
          <button type="button" aria-label="rotate left"
            onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRotate(-5); }}
            style={{ position:'absolute', left:-30, top:-30, width:24, height:24, border:'1px solid var(--line)', borderRadius:999, background:'var(--panel)', color:'var(--text)', zIndex:20 }}>↶</button>
          <button type="button" aria-label="rotate right"
            onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); onRotate(5); }}
            style={{ position:'absolute', right:-30, top:-30, width:24, height:24, border:'1px solid var(--line)', borderRadius:999, background:'var(--panel)', color:'var(--text)', zIndex:20 }}>↷</button>
          <span onPointerDown={e => down(e, 'resize')}
            style={{ position:'absolute', right:-7, bottom:-7, width:18, height:18, border:'1px solid var(--line)', borderRadius:999, background:'var(--panel)', display:'grid', placeItems:'center', zIndex:20, cursor:'nwse-resize' }}>↘</span>
        </>
      )}
    </div>
  );
}

export default function RoomPage() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [room, setRoom] = useState<RoomState>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [editOn, setEditOn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StickerLibraryItem[]>(DEFAULT_STICKERS);
  const canvas = useRef<HTMLDivElement>(null);
  const bgSrc = useBlobUrl(room.background);

  useEffect(() => {
    setRoom(readRoom()); setLoaded(true);
    return onSettingChange(key => { if (key === KEY) setRoom(readRoom()); });
  }, []);

  const save = (next: RoomState) => { setRoom(next); setSetting(KEY, next); };

  const addStickerToRoom = (imgId: string) => {
    if (!canvas.current) return;
    const r = canvas.current.getBoundingClientRect();
    const size = Math.min(190, Math.max(90, r.width * 0.17));
    const item: RoomItem = {
      id: newId(), imgId,
      x: Math.max(10, r.width / 2 - size / 2),
      y: Math.max(10, r.height / 2 - size / 2),
      w: size, h: size, rot: 0,
      z: Math.max(0, ...room.items.map(x => x.z)) + 1,
    };
    save({ ...room, items: [...room.items, item] });
    setSelected(item.id);
    toast('이미지를 방에 넣었어요');
  };
  const addStickerToLibrary = async (file: File) => {
    const imgId = await putBlob(file);
    const next = [...stickers, { id:newId(), imgId, name:file.name.replace(/\.[^/.]+$/,'') }];
    setStickers(next); setSetting(STICKER_KEY,next); addStickerToRoom(imgId);
  };
  const removeStickerFromLibrary = (id: string) => {
    const next = stickers.filter(x=>x.id!==id);
    setStickers(next); setSetting(STICKER_KEY,next); toast('스티커 보관함에서 삭제했어요');
  };

  const addImage = async (file: File) => {
    if (!canvas.current) return;
    const imgId = await putBlob(file);
    const r = canvas.current.getBoundingClientRect();
    const size = Math.min(280, Math.max(100, r.width * 0.22));
    const item: RoomItem = {
      id: newId(), imgId,
      x: Math.max(10, r.width / 2 - size / 2), y: Math.max(10, r.height / 2 - size / 2),
      w: size, h: size, rot: 0, z: Math.max(0, ...room.items.map(x => x.z)) + 1,
    };
    save({ ...room, items: [...room.items, item] });
    setSelected(item.id);
    toast('이미지를 추가했습니다');
  };

  const addBackground = async (file: File) => {
    const id = await putBlob(file);
    save({ ...room, background: id });
    toast('배경을 저장했습니다');
  };

  const updateItem = (id: string, patch: Partial<RoomItem>) =>
    save({ ...room, items: room.items.map(x => x.id === id ? { ...x, ...patch } : x) });

  const remove = () => {
    if (!selected) return;
    save({ ...room, items: room.items.filter(x => x.id !== selected) });
    setSelected(null);
  };

  const moveZ = (dir: 'top' | 'bottom') => {
    if (!selected) return;
    const zs = room.items.map(x => x.z);
    updateItem(selected, { z: dir === 'top' ? Math.max(...zs, 0) + 1 : Math.min(...zs, 0) - 1 });
  };

  if (!loaded) return <section className="page"><div className="panel">불러오는 중…</div></section>;

  const item = room.items.find(x => x.id === selected);

  return (
    <section className="page" style={{ maxWidth: 1200 }}>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>ROOM</h1>
          <p className="hint">이미지와 스티커로 나만의 미니홈피를 꾸며보세요.</p>
        </div>
        {isAdmin && <div className="head-actions">
          <button className="btn btn-dark" onClick={() => setEditOn(v => !v)}>{editOn ? '꾸미기 끝' : '꾸미기'}</button>
        </div>}
      </div>

      {isAdmin && editOn && (
        <div className="panel" style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
          <label className="btn btn-dark">＋ 이미지 추가
            <input type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0]; e.target.value=''; if(f) void addStickerToLibrary(f); }} />
          </label>
          <label className="btn btn-ghost">배경 바꾸기
            <input type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0]; e.target.value=''; if(f) void addBackground(f); }} />
          </label>
          {selected && <button className="btn btn-ghost" onClick={() => moveZ('top')}>맨 위</button>}
          {selected && <button className="btn btn-ghost" onClick={() => moveZ('bottom')}>맨 아래</button>}
          {selected && <button className="btn btn-ghost" onClick={remove}>삭제</button>}
          {selected && (
            <input className="k-input" style={{ minWidth:220, flex:1 }} placeholder="클릭 링크 (선택)"
              value={item?.link ?? ''} onChange={e => updateItem(selected, { link: e.target.value })} />
          )}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: editOn ? 'minmax(0,1fr) 245px' : 'minmax(0,1fr)', gap:12, alignItems:'start' }}>
      <div ref={canvas} onPointerDown={() => setSelected(null)}
        style={{ position:'relative', width:'100%', minHeight:'min(70vh, 760px)', overflow:'hidden',
          background: bgSrc ? 'url("' + bgSrc + '") center / cover no-repeat' : 'var(--bg)',
          border: editOn ? '1px dashed var(--line)' : '1px solid var(--line)', borderRadius:10 }}>
        {room.items.map(x => (
          <div key={x.id} style={{ position:'absolute', left:x.x, top:x.y, width:x.w, height:x.h,
            zIndex:x.z, transform:'rotate(' + x.rot + 'deg)', outline:editOn && selected === x.id ? '1px dashed var(--accent)' : undefined }}>
            <RoomImage id={x.imgId} selected={selected === x.id} editOn={editOn}
              onSelect={() => setSelected(x.id)}
              onMove={(dx,dy) => updateItem(x.id, { x:x.x + dx, y:x.y + dy })}
              onResize={(dw,dh) => updateItem(x.id, { w:Math.max(50,x.w + dw), h:Math.max(50,x.h + dh) })}
              onRotate={deg => updateItem(x.id, { rot:x.rot + deg })}
              onOpen={() => { if (x.link) window.open(x.link, '_blank', 'noopener,noreferrer'); }} />
          </div>
        ))}
        {room.items.length === 0 && <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', color:'var(--faint)' }}>
          {isAdmin ? '꾸미기 버튼을 눌러 이미지를 추가해보세요.' : '아직 꾸며진 방이 없습니다.'}
        </div>}
      </div>
      {editOn && <aside className="panel" style={{ padding:10, borderRadius:12, maxHeight:'min(70vh,760px)', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><strong style={{fontSize:13}}>스티커 보관함</strong><span className="hint">{stickers.length}개</span></div>
        <p className="hint" style={{fontSize:10.5, margin:'0 0 10px'}}>한 번 불러온 스티커는 여기서 다시 꺼내 쓸 수 있어요.</p>
        {stickers.length===0 ? <div style={{padding:20,textAlign:'center',border:'1px dashed var(--line)',borderRadius:10,fontSize:11,color:'var(--faint)'}}>아직 스티커가 없어요.<br/>위의 ＋ 스티커로 추가해보세요.</div> :
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>{stickers.map(x=><StickerLibraryCard key={x.id} sticker={x} onAdd={() => addStickerToRoom(x.imgId)} onRemove={() => removeStickerFromLibrary(x.id)}/>)}</div>}
      </aside>}
      </div>
      {editOn && <p className="hint" style={{ marginTop:8 }}>보관함에서 스티커를 여러 번 꺼내 쓸 수 있어요. 방에서 삭제해도 보관함에는 남습니다.</p>}
    </section>
  );
}

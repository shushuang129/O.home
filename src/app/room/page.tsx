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
type RoomState = { background?: string; backgroundScale?: number; backgroundX?: number; backgroundY?: number; description?: string; items: RoomItem[] };
type StickerLibraryItem = { id: string; imgId: string; name?: string };
const KEY = 'ohome.room.v1';
const STICKER_KEY = 'ohome.room.stickers.v1';
const ROOM_W = 1000;
const ROOM_H = 625;
const DEFAULT_DESCRIPTION = '이미지와 스티커로 나만의 미니홈피를 꾸며보세요.';
const DEFAULT: RoomState = { items: [], description: DEFAULT_DESCRIPTION, backgroundScale: 1, backgroundX: 50, backgroundY: 50 };
const DEFAULT_STICKERS: StickerLibraryItem[] = [];

function readRoom(): RoomState {
  try {
    const v = getSetting<RoomState>(KEY, DEFAULT);
    return { ...DEFAULT, ...v, description: v?.description ?? DEFAULT_DESCRIPTION, backgroundScale: v?.backgroundScale ?? 1, backgroundX: v?.backgroundX ?? 50, backgroundY: v?.backgroundY ?? 50, items: Array.isArray(v?.items) ? v.items : [] };
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
  const drag = useRef<{ x:number; y:number; mode:'move'|'resize' } | null>(null);

  const begin = (e: React.PointerEvent, mode:'move'|'resize') => {
    if (!editOn || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x:e.clientX, y:e.clientY, mode };
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    drag.current = { x:e.clientX, y:e.clientY, mode:d.mode };
    if (d.mode === 'move') onMove(dx,dy);
    else onResize(dx,dy);
  };

  const end = (e: React.PointerEvent) => {
    if (!drag.current) return;
    e.preventDefault();
    drag.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  if (!src) return null;

  return (
    <div
      onPointerDown={e => begin(e,'move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onClick={e => { e.stopPropagation(); if (!editOn) onOpen(); }}
      style={{ width:'100%', height:'100%', position:'relative', cursor:editOn?'move':'pointer', touchAction:'none' }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" draggable={false}
        style={{ width:'100%', height:'100%', objectFit:'contain', display:'block', userSelect:'none', pointerEvents:'none' }} />

      {editOn && selected && (
        <>
          <button type="button" aria-label="rotate left"
            onPointerDown={e=>e.stopPropagation()}
            onClick={e=>{e.stopPropagation();onRotate(-5);}}
            style={{position:'absolute',left:-30,top:-30,width:26,height:26,border:'1px solid var(--line)',borderRadius:999,background:'var(--panel)',zIndex:30,cursor:'pointer'}}>↶</button>
          <button type="button" aria-label="rotate right"
            onPointerDown={e=>e.stopPropagation()}
            onClick={e=>{e.stopPropagation();onRotate(5);}}
            style={{position:'absolute',right:-30,top:-30,width:26,height:26,border:'1px solid var(--line)',borderRadius:999,background:'var(--panel)',zIndex:30,cursor:'pointer'}}>↷</button>
          <button type="button" aria-label="resize"
            onPointerDown={e=>{ e.stopPropagation(); begin(e,'resize'); }}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            style={{position:'absolute',right:-10,bottom:-10,width:24,height:24,border:'1px solid var(--line)',borderRadius:7,background:'var(--panel)',zIndex:30,cursor:'nwse-resize'}}>↘</button>
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
  const [descriptionEditing, setDescriptionEditing] = useState(false);
  const [descriptionHover, setDescriptionHover] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const bgSrc = useBlobUrl(room.background);

  useEffect(() => {
    setRoom(readRoom());
    setStickers(getSetting<StickerLibraryItem[]>(STICKER_KEY, DEFAULT_STICKERS));
    setLoaded(true);
    return onSettingChange(key => {
      if (key === KEY) setRoom(readRoom());
      if (key === STICKER_KEY) setStickers(getSetting<StickerLibraryItem[]>(STICKER_KEY, DEFAULT_STICKERS));
    });
  }, []);

  const save = (next: RoomState) => { setRoom(next); setSetting(KEY, next); };

  const addStickerToRoom = (imgId: string) => {
    if (!canvas.current) return;
    const size = 150;
    const item: RoomItem = {
      id: newId(), imgId,
      x: ROOM_W / 2 - size / 2,
      y: ROOM_H / 2 - size / 2,
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

  const addBackground = async (file: File) => {
    const id = await putBlob(file);
    save({ ...room, background: id, backgroundScale: 1, backgroundX: 0, backgroundY: 0 });
    toast('배경을 저장했습니다');
  };

  const updateItem = (id: string, patch: Partial<RoomItem>) =>
    save({ ...room, items: room.items.map(x => x.id === id ? { ...x, ...patch } : x) });

  const moveItem = (id: string, dx: number, dy: number) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect) return;
    const designDx = dx * ROOM_W / rect.width;
    const designDy = dy * ROOM_H / rect.height;
    setRoom(prev => {
      const next = { ...prev, items: prev.items.map(x => x.id === id ? { ...x, x:x.x + designDx, y:x.y + designDy } : x) };
      setSetting(KEY, next);
      return next;
    });
  };

  const resizeItem = (id: string, dw: number, dh: number) => {
    const rect = canvas.current?.getBoundingClientRect();
    if (!rect) return;
    const designDw = dw * ROOM_W / rect.width;
    const designDh = dh * ROOM_H / rect.height;
    setRoom(prev => {
      const next = { ...prev, items: prev.items.map(x => x.id === id ? {
        ...x, w:Math.max(50,x.w + designDw), h:Math.max(50,x.h + designDh)
      } : x) };
      setSetting(KEY, next);
      return next;
    });
  };

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

  const setDescription = (value: string) => save({ ...room, description: value });
  const updateBackground = (patch: Partial<Pick<RoomState, 'backgroundScale' | 'backgroundX' | 'backgroundY'>>) => save({ ...room, ...patch });

  if (!loaded) return <section className="page"><div className="panel">불러오는 중…</div></section>;

  const item = room.items.find(x => x.id === selected);

  return (
    <section className="page" style={{ maxWidth: 1200 }}>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>ROOM</h1>
          <div
            onMouseEnter={() => setDescriptionHover(true)}
            onMouseLeave={() => setDescriptionHover(false)}
            style={{display:'inline-flex',alignItems:'center',gap:4,maxWidth:'100%'}}
          >
            {descriptionEditing ? (
              <p
                className="hint"
                contentEditable={isAdmin}
                suppressContentEditableWarning
                autoFocus
                onBlur={e => {
                  if (isAdmin) setDescription(e.currentTarget.textContent?.trim() || DEFAULT_DESCRIPTION);
                  setDescriptionEditing(false);
                }}
                style={{margin:0,outline:'1px dashed var(--line)',borderRadius:6,padding:'3px 5px',cursor:'text'}}
              >{room.description ?? DEFAULT_DESCRIPTION}</p>
            ) : (
              <>
                <p className="hint" style={{margin:0,padding:'3px 5px'}}>{room.description ?? DEFAULT_DESCRIPTION}</p>
                {isAdmin && descriptionHover && (
                  <button
                    type="button"
                    aria-label="문구 수정"
                    onClick={() => setDescriptionEditing(true)}
                    style={{border:0,background:'transparent',padding:2,cursor:'pointer',fontSize:13,lineHeight:1,opacity:.65}}
                    title="문구 수정"
                  >✎</button>
                )}
              </>
            )}
          </div>
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
          <label className="btn btn-ghost" style={{display:'inline-flex',alignItems:'center',gap:6}}>배경 확대
            <input type="range" min="1" max="3" step="0.05" value={room.backgroundScale ?? 1} onChange={e=>updateBackground({backgroundScale:Number(e.target.value)})} />
          </label>
          <label className="btn btn-ghost" style={{display:'inline-flex',alignItems:'center',gap:6}}>위·아래
            <input type="range" min="0" max="100" step="1" value={room.backgroundY ?? 50} onChange={e=>updateBackground({backgroundY:Number(e.target.value)})} />
          </label>
          <label className="btn btn-ghost" style={{display:'inline-flex',alignItems:'center',gap:6}}>좌·우
            <input type="range" min="0" max="100" step="1" value={room.backgroundX ?? 50} onChange={e=>updateBackground({backgroundX:Number(e.target.value)})} />
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
        style={{ position:'relative', width:'100%', aspectRatio:'16 / 10', overflow:'hidden',
          background: 'var(--bg)',
          border: editOn ? '1px dashed var(--line)' : '1px solid var(--line)', borderRadius:10 }}>
        {bgSrc && <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          {/* object-fit: cover keeps the image ratio; object-position chooses which part is shown. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgSrc}
            alt=""
            draggable={false}
            style={{
              width:'100%',
              height:'100%',
              display:'block',
              objectFit:'cover',
              objectPosition:(room.backgroundX ?? 50) + '% ' + (room.backgroundY ?? 50) + '%',
              transform:'scale(' + (room.backgroundScale ?? 1) + ')',
              transformOrigin:'center center'
            }}
          />
        </div>}
        {room.items.map(x => (
          <div key={x.id} style={{ position:'absolute', left:(x.x / ROOM_W * 100) + '%', top:(x.y / ROOM_H * 100) + '%',
            width:(x.w / ROOM_W * 100) + '%', height:(x.h / ROOM_H * 100) + '%',
            zIndex:x.z, transform:'rotate(' + x.rot + 'deg)', transformOrigin:'center center',
            outline:editOn && selected === x.id ? '1px dashed var(--accent)' : undefined }}>
            <RoomImage id={x.imgId} selected={selected === x.id} editOn={editOn}
              onSelect={() => setSelected(x.id)}
              onMove={(dx,dy) => moveItem(x.id, dx,dy)}
              onResize={(dw,dh) => resizeItem(x.id, dw,dh)}
              onRotate={deg => updateItem(x.id, { rot:x.rot + deg })}
              onOpen={() => { if (x.link) window.open(x.link, '_blank', 'noopener,noreferrer'); }} />
          </div>
        ))}
        {room.items.length === 0 && <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', color:'var(--faint)' }}>
          {isAdmin ? '꾸미기 버튼을 눌러 이미지를 추가해보세요.' : '아직 꾸며진 방이 없습니다.'}
        </div>}
      </div>
      {editOn && <aside className="panel" style={{ padding:10, borderRadius:12, maxHeight:'min(70vh,625px)', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><strong style={{fontSize:13}}>스티커 보관함</strong><span className="hint">{stickers.length}개</span></div>
        <p className="hint" style={{fontSize:10.5, margin:'0 0 10px'}}>한 번 불러온 스티커는 여기서 다시 꺼내 쓸 수 있어요.</p>
        {stickers.length===0 ? <div style={{padding:20,textAlign:'center',border:'1px dashed var(--line)',borderRadius:10,fontSize:11,color:'var(--faint)'}}>아직 스티커가 없어요.<br/>위의 ＋ 이미지 추가로 추가해보세요.</div> :
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>{stickers.map(x=><StickerLibraryCard key={x.id} sticker={x} onAdd={() => addStickerToRoom(x.imgId)} onRemove={() => removeStickerFromLibrary(x.id)}/>)}</div>}
      </aside>}
      </div>
      {editOn && <p className="hint" style={{ marginTop:8 }}>보관함에서 스티커를 여러 번 꺼내 쓸 수 있어요. 방에서 삭제해도 보관함에는 남습니다.</p>}
    </section>
  );
}

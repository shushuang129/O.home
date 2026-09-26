'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getSetting, onSettingChange, setSetting } from '@/lib/settingStore';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { newId } from '@/lib/postStore';
import { useAuth } from '@/lib/auth';
import { EditableDesc } from '@/components/ui/PageText';
import { useToast } from '@/components/ui/Toast';

type RoomItem = {
  id: string; imgId: string; x: number; y: number; w: number; h: number;
  rot: number; z: number; link?: string;
};
type RoomState = { background?: string; description?: string; items: RoomItem[] };
type StickerLibraryItem = { id: string; imgId: string; name?: string };
const KEY = 'ohome.room.v1';
const STICKER_KEY = 'ohome.room.stickers.v1';
const ROOM_W = 1000;
const ROOM_H = 625;
const DEFAULT_DESCRIPTION = '이미지와 스티커로 나만의 미니홈피를 꾸며보세요.';
const DEFAULT: RoomState = { items: [], description: DEFAULT_DESCRIPTION };
const DEFAULT_STICKERS: StickerLibraryItem[] = [];

function readRoom(): RoomState {
  try {
    const v = getSetting<RoomState>(KEY, DEFAULT);
    return { ...DEFAULT, ...v, description: v?.description ?? DEFAULT_DESCRIPTION, items: Array.isArray(v?.items) ? v.items : [] };
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

function BackgroundCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (file: File) => void }) {
  const VIEW_W = 720;
  const VIEW_H = 450;
  const [src, setSrc] = useState('');
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x:number; y:number; px:number; py:number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = imgSize.w && imgSize.h ? Math.max(VIEW_W / imgSize.w, VIEW_H / imgSize.h) : 1;
  const shownW = imgSize.w * baseScale * scale;
  const shownH = imgSize.h * baseScale * scale;
  const maxX = Math.max(0, (shownW - VIEW_W) / 2);
  const maxY = Math.max(0, (shownH - VIEW_H) / 2);
  const clampPos = (x:number,y:number) => ({x:Math.max(-maxX,Math.min(maxX,x)),y:Math.max(-maxY,Math.min(maxY,y))});

  const down=(e:React.PointerEvent<HTMLDivElement>)=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,px:pos.x,py:pos.y};};
  const move=(e:React.PointerEvent<HTMLDivElement>)=>{if(!drag.current)return;const d=drag.current;setPos(clampPos(d.px+e.clientX-d.x,d.py+e.clientY-d.y));};
  const up=()=>{drag.current=null;};

  const crop=()=>{
    if(!imgSize.w||!imgSize.h)return;
    const cv=document.createElement('canvas'); cv.width=VIEW_W; cv.height=VIEW_H;
    const ctx=cv.getContext('2d'); if(!ctx)return;
    const left=(VIEW_W-shownW)/2+pos.x, top=(VIEW_H-shownH)/2+pos.y;
    const image=new Image();
    image.onload=()=>{ctx.drawImage(image,left,top,shownW,shownH);cv.toBlob(blob=>{if(blob)onDone(new File([blob],'room-background.jpg',{type:'image/jpeg'}));},'image/jpeg',0.92);};
    image.src=src;
  };

  return <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.55)',display:'grid',placeItems:'center',padding:20}}>
    <div className="panel" style={{width:'min(780px,95vw)',padding:16,borderRadius:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong>배경 자르기</strong><span className="hint">16 : 10 · 이미지를 드래그해서 원하는 부분을 맞춰주세요.</span></div>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{width:'100%',aspectRatio:'16 / 10',overflow:'hidden',position:'relative',background:'var(--bg)',cursor:'grab',touchAction:'none',borderRadius:10}}>
        {src&&<img src={src} alt="" draggable={false} onLoad={e=>setImgSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})} style={{position:'absolute',width:shownW,height:shownH,maxWidth:'none',left:'50%',top:'50%',transform:'translate(-50%,-50%) translate('+pos.x+'px,'+pos.y+'px)',userSelect:'none',pointerEvents:'none'}}/>}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,marginTop:12}}>
        <span className="hint" style={{whiteSpace:'nowrap'}}>확대/축소</span>
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={scale}
          onChange={e=>setScale(Number(e.target.value))}
          style={{flex:1}}
        />
        <span className="hint" style={{minWidth:42,textAlign:'right'}}>{Math.round(scale * 100)}%</span>
        <button type="button" className="btn btn-ghost" onClick={()=>{setScale(1);setPos({x:0,y:0});}}>초기화</button>
      </div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:10}}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button>
        <button type="button" className="btn btn-dark" onClick={crop}>이대로 자르기</button>
      </div>
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
  const [backgroundCropFile, setBackgroundCropFile] = useState<File | null>(null);
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
    save({ ...room, background: id });
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


  if (!loaded) return <section className="page"><div className="panel">불러오는 중…</div></section>;

  const item = room.items.find(x => x.id === selected);

  return (
    <section className="page" style={{ maxWidth: 1100 }}>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>ROOM</h1>
          <EditableDesc k="room-desc" def={DEFAULT_DESCRIPTION} />
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
            <input type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0]; e.target.value=''; if(f) setBackgroundCropFile(f); }} />
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

      <div style={{ display:'grid', gridTemplateColumns: editOn ? 'minmax(0,1fr) 245px' : '1fr', gap:12, alignItems:'start', width: editOn ? 'calc(100% + 257px)' : '100%' }}>
      <div ref={canvas} onPointerDown={() => setSelected(null)}
        style={{ position:'relative', width:'100%', aspectRatio:'16 / 10', overflow:'hidden',
          background: 'var(--bg)',
          border: editOn ? '1px dashed var(--line)' : '1px solid var(--line)', borderRadius:10 }}>
        {bgSrc && <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none'}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={bgSrc} alt="" draggable={false} style={{width:'100%',height:'100%',display:'block',objectFit:'fill'}} />
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
      {backgroundCropFile && <BackgroundCropper file={backgroundCropFile} onCancel={()=>setBackgroundCropFile(null)} onDone={async file=>{setBackgroundCropFile(null);await addBackground(file);}} />}
    </section>
  );
}

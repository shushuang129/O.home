'use client';

import React, { useEffect, useRef, useState } from 'react';
import { getSetting, onSettingChange, setSetting } from '@/lib/settingStore';
import { useFonts } from '@/lib/fontStore';
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
const ROOM_W = 800;
const ROOM_H = 600;
const DEFAULT_DESCRIPTION = '이미지와 스티커로 나만의 미니홈피를 꾸며보세요.';
const DEFAULT: RoomState = { items: [], description: DEFAULT_DESCRIPTION };
const DEFAULT_STICKERS: StickerLibraryItem[] = [];

function readRoom(): RoomState {
  try {
    const v = getSetting<RoomState>(KEY, DEFAULT);
    return { ...DEFAULT, ...v, description: v?.description ?? DEFAULT_DESCRIPTION, items: Array.isArray(v?.items) ? v.items : [] };
  } catch { return DEFAULT; }
}


function RoomProfileImage({ id }: { id: string }) {
  const src = useBlobUrl(id);
  if (!src) return null;
  return <img src={src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />;
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
  const VIEW_W = 576;
  const VIEW_H = 432;
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
    const OUTPUT_W = 800;
    const OUTPUT_H = 600;
    const scaleOut = OUTPUT_W / VIEW_W;
    const cv=document.createElement('canvas');
    cv.width=OUTPUT_W;
    cv.height=OUTPUT_H;
    const ctx=cv.getContext('2d');
    if(!ctx)return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const left=((VIEW_W-shownW)/2+pos.x) * scaleOut;
    const top=((VIEW_H-shownH)/2+pos.y) * scaleOut;
    const image=new Image();
    image.onload=()=>{
      ctx.drawImage(image,left,top,shownW*scaleOut,shownH*scaleOut);
      cv.toBlob(blob=>{
        if(blob)onDone(new File([blob],'room-background.png',{type:'image/png'}));
      },'image/png');
    };
    image.src=src;
  };

  return <div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.55)',display:'grid',placeItems:'center',padding:20}}>
    <div className="panel" style={{width:'min(780px,95vw)',padding:16,borderRadius:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong>배경 자르기</strong><span className="hint">4 : 3 · 이미지를 드래그해서 원하는 부분을 맞춰주세요.</span></div>
      <div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{width:'100%',aspectRatio:'4 / 3',overflow:'hidden',position:'relative',background:'var(--bg)',cursor:'grab',touchAction:'none',borderRadius:10}}>
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


function ProfileCropper({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (file: File) => void }) {
  const VIEW_W = 560, VIEW_H = 420;
  const [src, setSrc] = useState('');
  const [imgSize, setImgSize] = useState({w:0,h:0});
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({x:0,y:0});
  const drag = useRef<{x:number;y:number;px:number;py:number}|null>(null);
  useEffect(() => { const url=URL.createObjectURL(file); setSrc(url); return()=>URL.revokeObjectURL(url); },[file]);
  const base = imgSize.w&&imgSize.h ? Math.max(VIEW_W/imgSize.w,VIEW_H/imgSize.h) : 1;
  const shownW=imgSize.w*base*scale, shownH=imgSize.h*base*scale;
  const maxX=Math.max(0,(shownW-VIEW_W)/2), maxY=Math.max(0,(shownH-VIEW_H)/2);
  const clamp=(x:number,y:number)=>({x:Math.max(-maxX,Math.min(maxX,x)),y:Math.max(-maxY,Math.min(maxY,y))});
  const down=(e:React.PointerEvent<HTMLDivElement>)=>{if(e.button!==0)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,px:pos.x,py:pos.y};};
  const move=(e:React.PointerEvent<HTMLDivElement>)=>{if(!drag.current)return;const d=drag.current;setPos(clamp(d.px+e.clientX-d.x,d.py+e.clientY-d.y));};
  const up=()=>{drag.current=null;};
  const crop=()=>{if(!src||!imgSize.w||!imgSize.h)return;const cv=document.createElement('canvas');cv.width=VIEW_W;cv.height=VIEW_H;const ctx=cv.getContext('2d');if(!ctx)return;const left=(VIEW_W-shownW)/2+pos.x,top=(VIEW_H-shownH)/2+pos.y;const image=new Image();image.onload=()=>{ctx.drawImage(image,left,top,shownW,shownH);cv.toBlob(b=>{if(b)onDone(new File([b],'profile.jpg',{type:'image/jpeg'}));},'image/jpeg',.92);};image.src=src;};
  return <div style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(20,18,15,.55)',display:'grid',placeItems:'center',padding:20}}><div className="panel" style={{width:'min(650px,95vw)',padding:16,borderRadius:14}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><strong>프로필 사진 맞추기</strong><span className="hint">4 : 3 · 드래그해서 위치를 맞춰주세요.</span></div><div onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{width:'100%',aspectRatio:'4 / 3',overflow:'hidden',position:'relative',background:'var(--bg)',cursor:'grab',touchAction:'none',borderRadius:10}}>{src&&<img src={src} alt="" draggable={false} onLoad={e=>setImgSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})} style={{position:'absolute',width:shownW,height:shownH,maxWidth:'none',left:'50%',top:'50%',transform:'translate(-50%,-50%) translate('+pos.x+'px,'+pos.y+'px)',userSelect:'none',pointerEvents:'none'}}/>}</div><div style={{display:'flex',alignItems:'center',gap:10,marginTop:12}}><span className="hint">확대/축소</span><input type="range" min="1" max="3" step=".01" value={scale} onChange={e=>setScale(Number(e.target.value))} style={{flex:1}}/><span className="hint">{Math.round(scale*100)}%</span><button type="button" className="btn btn-ghost" onClick={()=>{setScale(1);setPos({x:0,y:0});}}>초기화</button></div><div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:10}}><button type="button" className="btn btn-ghost" onClick={onCancel}>취소</button><button type="button" className="btn btn-dark" onClick={crop}>이대로 자르기</button></div></div></div>;
}

function RoomImage({ id, selected, editOn, onSelect, onMove, onResize, onRotate, onOpen, rot }: {
  id: string; selected: boolean; editOn: boolean; onSelect: () => void;
  onMove: (dx: number, dy: number) => void; onResize: (dw: number, dh: number) => void;
  onRotate: (deg: number) => void; onOpen: () => void; rot: number;
}) {
  const src = useBlobUrl(id);
  const drag = useRef<{ x:number; y:number; mode:'move'|'resize' } | null>(null);
  const rotateDrag = useRef<{ lastAngle:number } | null>(null);
  const rotation = useRef(rot);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTarget = useRef<number | null>(null);
  const snapped = useRef(false);

  const clearSnap = () => {
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = null;
    snapTarget.current = null;
  };

  const normalizeAngle = (angle:number) => ((angle + 180) % 360 + 360) % 360 - 180;

  const beginRotate = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!editOn || !selected || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect();
    clearSnap();
    snapped.current = false;
    rotation.current = rot;

    const box = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    rotateDrag.current = {
      lastAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveRotate = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = rotateDrag.current;
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();

    const box = e.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
    let delta = angle - d.lastAngle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    d.lastAngle = angle;

    const deltaDeg = delta * 180 / Math.PI;
    rotation.current += deltaDeg;

    const normalized = ((rotation.current % 360) + 360) % 360;
    const targets = [0, 90, 180, 270];
    let nearest = targets[0];
    let distance = 360;
    for (const target of targets) {
      const d = Math.abs(normalized - target);
      const wrapped = Math.min(d, 360 - d);
      if (wrapped < distance) {
        distance = wrapped;
        nearest = target;
      }
    }

    const SNAP_RANGE = 8;
    const SNAP_DELAY = 450;

    if (distance <= SNAP_RANGE) {
      if (snapTarget.current !== nearest) {
        clearSnap();
        snapTarget.current = nearest;
        snapTimer.current = setTimeout(() => {
          if (snapTarget.current !== nearest) return;

          const current = ((rotation.current % 360) + 360) % 360;
          const currentDistance = Math.min(
            Math.abs(current - nearest),
            360 - Math.abs(current - nearest)
          );

          if (currentDistance <= SNAP_RANGE) {
            let correction = nearest - current;
            if (correction > 180) correction -= 360;
            if (correction < -180) correction += 360;

            rotation.current += correction;
            snapped.current = true;
            onRotate(correction);
          }
          snapTimer.current = null;
        }, SNAP_DELAY);
      }
    } else {
      clearSnap();
      snapped.current = false;
    }

    if (!snapped.current) onRotate(deltaDeg);
  };

  const endRotate = (e: React.PointerEvent<HTMLButtonElement>) => {
    rotateDrag.current = null;
    clearSnap();
    snapped.current = false;
    e.stopPropagation();
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

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
          <button type="button" aria-label="rotate"
            onPointerDown={beginRotate}
            onPointerMove={moveRotate}
            onPointerUp={endRotate}
            onPointerCancel={endRotate}
            title="드래그해서 회전"
            style={{position:'absolute',left:'50%',top:-30,transform:'translateX(-50%)',width:28,height:28,border:'1px solid var(--line)',borderRadius:999,background:'var(--panel)',zIndex:30,cursor:'grab',touchAction:'none'}}>↻</button>
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
  const { isAdmin, user, updateProfile } = useAuth();
  const { fonts, familyOf } = useFonts();
  const toast = useToast();
  const [room, setRoom] = useState<RoomState>(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [editOn, setEditOn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [stickers, setStickers] = useState<StickerLibraryItem[]>(DEFAULT_STICKERS);
  const [backgroundCropFile, setBackgroundCropFile] = useState<File | null>(null);
  const [editTab, setEditTab] = useState<'stickers' | 'background'>('stickers');
  const [profileEditOn, setProfileEditOn] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileColor, setProfileColor] = useState('#d8d2c8');
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [profileCropFile, setProfileCropFile] = useState<File | null>(null);
  const [profileFont, setProfileFont] = useState('var(--serif)');
  const [profileAvatarRef, setProfileAvatarRef] = useState<string | undefined>(user?.avatarUrl);
  const canvas = useRef<HTMLDivElement>(null);
  const bgSrc = useBlobUrl(room.background);

  useEffect(() => {
    setProfileName(user?.nickname ?? '');
    setProfileColor(user?.avatarColor ?? '#d8d2c8');
    setProfileAvatarRef(user?.avatarUrl);
    setProfileFont(getSetting<string>(`ohome.room.profile.font.${user?.id ?? 'guest'}`, 'serif'));
  }, [user?.id, user?.nickname, user?.avatarColor, user?.avatarUrl]);

  useEffect(() => {
    if (!profileFile) { setProfilePreview(null); return; }
    const url = URL.createObjectURL(profileFile);
    setProfilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [profileFile]);

  const saveProfile = async () => {
    if (!user) return;
    let avatarUrl: string | undefined = user.avatarUrl;
    if (profileFile) avatarUrl = await putBlob(profileFile);
    const result = await updateProfile({
      nickname: profileName.trim() || user.nickname,
      avatarUrl,
      avatarColor: profileColor,
    });
    if (result.ok) {
      setProfileAvatarRef(avatarUrl);
      setSetting(`ohome.room.profile.font.${user.id}`, profileFont);
      setProfileEditOn(false);
      setProfileFile(null);
      toast('프로필을 저장했어요');
    } else {
      toast(result.error ?? '프로필을 저장하지 못했어요');
    }
  };

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
    const size = 120;
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

  const moveZ = (dir: 'top' | 'bottom' | 'up' | 'down') => {
    if (!selected) return;
    if (dir === 'top' || dir === 'bottom') {
      const zs = room.items.map(x => x.z);
      updateItem(selected, { z: dir === 'top' ? Math.max(...zs, 0) + 1 : 1 });
      return;
    }

    const ordered = [...room.items].sort((a, b) => a.z - b.z);
    const index = ordered.findIndex(x => x.id === selected);
    const targetIndex = dir === 'up' ? index + 1 : index - 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;

    const current = ordered[index];
    const target = ordered[targetIndex];
    if (dir === 'down' && index === 0) return;
    const nextItems = room.items.map(x => {
      if (x.id === current.id) return { ...x, z: target.z };
      if (x.id === target.id) return { ...x, z: current.z };
      return x;
    });
    save({ ...room, items: nextItems });
  };

  if (!loaded) return <section className="page"><div className="panel">불러오는 중…</div></section>;

  const item = room.items.find(x => x.id === selected);

  return (
    <section className="page room-page" style={{ maxWidth: 1320, width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .room-page{
          --room-sky:#c9effa;
          --room-sky-deep:#9edff2;
          --room-blue:#62c6e2;
          --room-pink:#f7b8d8;
          --room-yellow:#ffe59a;
          --room-white:#fffdf8;
          position:relative;
          min-height:calc(100vh - 110px);
          padding:26px 24px 50px !important;
          overflow:hidden;
          background:
            linear-gradient(rgba(255,255,255,.28) 1px,transparent 1px),
            linear-gradient(90deg,rgba(255,255,255,.28) 1px,transparent 1px),
            linear-gradient(135deg,#d9f7ff,#bcebf7);
          background-size:24px 24px,24px 24px,100% 100%;
          border:2px solid rgba(92,190,218,.42);
          border-radius:22px;
          box-shadow:inset 0 0 0 7px rgba(255,255,255,.38),0 18px 45px rgba(61,160,191,.16);
        }
        .room-page:before,.room-page:after{
          content:"";
          position:absolute;
          border-radius:999px;
          pointer-events:none;
          opacity:.72;
          filter:blur(.2px);
        }
        .room-page:before{
          width:170px;height:58px;left:-34px;top:96px;
          background:
            radial-gradient(circle at 28% 65%,#fff 0 27%,transparent 28%),
            radial-gradient(circle at 52% 42%,#fff 0 35%,transparent 36%),
            radial-gradient(circle at 74% 66%,#fff 0 25%,transparent 26%);
        }
        .room-page:after{
          width:210px;height:70px;right:-52px;bottom:58px;
          background:
            radial-gradient(circle at 28% 65%,#fff 0 28%,transparent 29%),
            radial-gradient(circle at 52% 42%,#fff 0 37%,transparent 38%),
            radial-gradient(circle at 76% 66%,#fff 0 27%,transparent 28%);
        }
        .room-page .page-head{
          position:relative;
          z-index:2;
          width:min(800px,100%);
          margin:8px auto 0;
          padding:13px 17px;
          box-sizing:border-box;
          background:rgba(255,253,248,.9);
          border:2px solid rgba(98,198,226,.58);
          border-radius:15px;
          box-shadow:4px 5px 0 rgba(98,198,226,.18),0 10px 22px rgba(59,148,177,.12);
        }
        .room-page .page-head h1{
          color:#358eac;
          letter-spacing:.08em;
          text-shadow:1px 1px 0 #fff;
        }
        .room-page .room-stage{
          z-index:2;
        }
        .room-page .room-canvas{
          border:3px solid rgba(84,184,215,.72) !important;
          border-radius:12px !important;
          box-shadow:
            0 0 0 4px rgba(255,255,255,.92),
            0 0 0 7px rgba(91,190,218,.36),
            8px 10px 0 rgba(73,171,201,.22),
            0 18px 32px rgba(57,143,170,.18) !important;
          background:#fffdf8 !important;
        }
        .room-page .room-side-card,
        .room-page .panel{
          border-color:rgba(91,190,218,.38) !important;
          background:rgba(255,253,248,.94) !important;
          box-shadow:4px 5px 0 rgba(98,198,226,.13),0 10px 22px rgba(59,148,177,.12) !important;
        }
        .room-page .room-side-card:before{
          content:"";
          display:block;
          width:38px;height:7px;
          margin:-8px auto 9px;
          border-radius:999px;
          background:linear-gradient(90deg,var(--room-pink) 0 50%,var(--room-yellow) 50%);
          opacity:.9;
        }
        .room-page .btn{
          border-color:rgba(91,190,218,.42);
        }
        .room-page .btn-dark{
          background:#58b9d5;
          color:white;
          border-color:#4aaac7;
          box-shadow:2px 3px 0 rgba(65,154,182,.24);
        }
        .room-page .btn-dark:hover{background:#48afce}
        .room-page .btn-ghost:hover{background:#e7f8fc}
        .room-page .k-input,.room-page select{
          border-color:rgba(91,190,218,.38);
          background:#fffefa;
        }
        .room-page .room-spark{
          position:absolute;
          z-index:1;
          pointer-events:none;
          color:#fff;
          text-shadow:0 1px 3px rgba(67,164,193,.35);
          font-size:20px;
        }
        .room-page .room-spark.s1{left:8%;top:18%;transform:rotate(-12deg)}
        .room-page .room-spark.s2{right:9%;top:13%;font-size:14px;transform:rotate(16deg)}
        .room-page .room-spark.s3{left:14%;bottom:12%;font-size:15px;transform:rotate(8deg)}
        .room-page .room-spark.s4{right:15%;bottom:18%;font-size:23px;transform:rotate(-9deg)}
        @media(max-width:960px){
          .room-page{padding-left:14px !important;padding-right:14px !important}
          .room-page .room-side-card{display:none}
        }
        @media(max-width:620px){
          .room-page{padding:14px 10px 70px !important;border-radius:16px}
          .room-page .page-head{border-radius:12px}
          .room-page .room-spark{display:none}
        }
      `}</style>
      <span className="room-spark s1">✦</span>
      <span className="room-spark s2">◇</span>
      <span className="room-spark s3">♡</span>
      <span className="room-spark s4">✧</span>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0, display:'flex', alignItems:'center', gap:7 }}>
            <span aria-hidden="true" style={{ fontSize:16, transform:'rotate(-8deg)', display:'inline-block' }}>✦</span>
            <span>ROOM</span>
            <span aria-hidden="true" style={{ fontSize:12, opacity:.7, transform:'rotate(8deg)', display:'inline-block' }}>♡</span>
          </h1>
          <EditableDesc k="room-desc" def={DEFAULT_DESCRIPTION} />
          </div>
        {isAdmin && <div className="head-actions">
          <button className="btn btn-dark" onClick={() => setEditOn(v => !v)}>{editOn ? '✦ 꾸미기 끝' : '✦ 꾸미기'}</button>
        </div>}
      </div>

      <div className="room-stage" style={{ position:'relative', width:'800px', minWidth:'800px', maxWidth:'none', margin:'28px auto 0' }}>
        {!editOn && <aside className="room-side-card" style={{ position:'absolute', right:'calc(100% + 18px)', top:0, width:220, boxSizing:'border-box', padding:17, borderRadius:16, background:'var(--panel)', border:'1px solid var(--line)', boxShadow:'0 10px 24px rgba(0,0,0,.07)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:9, letterSpacing:'.16em', color:'var(--faint)' }}>PROFILE</span>
            <button type="button" className="btn btn-ghost" onClick={()=>setProfileEditOn(true)} style={{ padding:'4px 7px', fontSize:9 }}>EDIT</button>
          </div>
          <div style={{ width:'100%', aspectRatio:'4 / 3', borderRadius:10, overflow:'hidden', border:'1px solid var(--line)', background:user?.avatarColor ?? 'linear-gradient(135deg,#ddd8cf,#aaa39a)', boxShadow:'0 5px 15px rgba(0,0,0,.06)' }}>
            {(profileAvatarRef ?? user?.avatarUrl) && <RoomProfileImage key={profileAvatarRef ?? user?.avatarUrl} id={profileAvatarRef ?? user!.avatarUrl!} />}
          </div>
          <div style={{ textAlign:'center', marginTop:12 }}>
            <strong style={{ display:'block', fontFamily:familyOf(profileFont) ?? 'var(--serif)', fontSize:20 }}>{user?.nickname ?? 'MY ROOM'}</strong>
            <span style={{ display:'block', marginTop:3, fontSize:8, letterSpacing:'.14em', color:'var(--faint)' }}>{user ? 'MY PROFILE' : 'WELCOME'}</span>
          </div>
          <p style={{ margin:'10px 2px 13px', textAlign:'center', fontFamily:'var(--serif)', fontSize:10.5, lineHeight:1.6, color:'var(--faint)' }}>
          </p>
          <div style={{ borderTop:'1px dashed var(--line)', paddingTop:11 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:7.5, letterSpacing:'.1em', color:'var(--faint)' }}>
              <span>NOW PLAYING</span><span style={{fontSize:18}}>♪</span>
            </div>
            <div style={{ height:2, margin:'8px 0', background:'var(--line)', borderRadius:2, overflow:'hidden' }}><span style={{ display:'block', width:'38%', height:'100%', background:'var(--accent)', opacity:.65 }} /></div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:16, color:'var(--faint)', fontSize:11 }}>
              <span style={{fontSize:21}}>◂◂</span><span style={{ display:'grid', placeItems:'center', width:44, height:44, borderRadius:'50%', background:'var(--text)', color:'var(--faint)', fontSize:18 }}>▶</span><span style={{fontSize:21}}>▸▸</span>
            </div>
          </div>
        </aside>}
      {editOn && <aside className="panel" style={{ position:'absolute', left:-145, top:0, width:'120px', boxSizing:'border-box', padding:10, borderRadius:14, boxShadow:'0 8px 20px rgba(0,0,0,.06)', zIndex:40 }}>
        <div style={{ fontSize:10, letterSpacing:'.08em', opacity:.55, marginBottom:7 }}>EDIT</div>
        <div style={{ display:'grid', gap:6 }}>
          <button className="btn btn-ghost" onClick={() => moveZ('top')} disabled={!selected}>맨 위</button>
          <button className="btn btn-ghost" onClick={() => moveZ('up')} disabled={!selected}>위</button>
          <button className="btn btn-ghost" onClick={() => moveZ('down')} disabled={!selected}>아래</button>
          <button className="btn btn-ghost" onClick={() => moveZ('bottom')} disabled={!selected}>맨 아래</button>
          <button className="btn btn-ghost" onClick={remove} disabled={!selected}>삭제</button>
          <input className="k-input" style={{ width:'100%', boxSizing:'border-box' }} placeholder="클릭 링크 (선택)"
            disabled={!selected}
            value={item?.link ?? ''} onChange={e => selected && updateItem(selected, { link: e.target.value })} />
        </div>
      </aside>}
      <div style={{ position:'relative', width:'800px', minWidth:'800px', height:'600px', minHeight:'600px', overflow:'visible', flex:'0 0 800px' }}>
        <div className="room-canvas" ref={canvas} onPointerDown={() => setSelected(null)}
          style={{ position:'relative', width:'800px', height:'600px', minWidth:'800px', minHeight:'600px', boxSizing:'border-box', overflow:'hidden',
            background: 'var(--bg)',
            border: editOn ? '1px dashed var(--line)' : '1px solid var(--line)', borderRadius:14,
            boxShadow:'0 10px 24px rgba(0,0,0,.08), 0 0 0 4px var(--panel)' }}>
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
              onRotate={deg => {
                setRoom(prev => {
                  const next = {
                    ...prev,
                    items: prev.items.map(item => item.id === x.id ? { ...item, rot:item.rot + deg } : item),
                  };
                  setSetting(KEY, next);
                  return next;
                });
              }}
              rot={x.rot}
              onOpen={() => { if (x.link) window.open(x.link, '_blank', 'noopener,noreferrer'); }} />
          </div>
        ))}
        {room.items.length === 0 && !room.background && <div style={{ position:'absolute', inset:0, display:'grid', placeItems:'center', color:'var(--faint)' }}>
          {isAdmin ? '꾸미기 버튼을 눌러 이미지를 추가해보세요.' : '아직 꾸며진 방이 없습니다.'}
        </div>}
      </div>
      </div>
      {editOn && <aside className="panel" style={{ position:'absolute', left:'calc(100% + 12px)', top:0, width:'200px', boxSizing:'border-box', padding:10, borderRadius:14, maxHeight:'min(70vh,750px)', overflowY:'auto', boxShadow:'0 8px 20px rgba(0,0,0,.06)', zIndex:40 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:9 }}>
          <div>
            <div style={{ fontSize:10, letterSpacing:'.08em', opacity:.55 }}>MY COLLECTION</div>
            <strong style={{ fontSize:14 }}>ROOM 꾸미기</strong>
          </div>
          <span aria-hidden="true" style={{ fontSize:16, opacity:.65 }}>✦</span>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5, padding:4, border:'1px solid var(--line)', borderRadius:10, background:'var(--bg)', marginBottom:10 }}>
          <button type="button" onClick={()=>setEditTab('stickers')}
            style={{ border:0, borderRadius:7, padding:'7px 4px', background:editTab==='stickers'?'var(--panel)':'transparent', color:'inherit', cursor:'pointer', fontSize:11, fontWeight:editTab==='stickers'?700:500, boxShadow:editTab==='stickers'?'0 2px 8px rgba(0,0,0,.05)':'none' }}>
            ✦ 스티커
          </button>
          <button type="button" onClick={()=>setEditTab('background')}
            style={{ border:0, borderRadius:7, padding:'7px 4px', background:editTab==='background'?'var(--panel)':'transparent', color:'inherit', cursor:'pointer', fontSize:11, fontWeight:editTab==='background'?700:500, boxShadow:editTab==='background'?'0 2px 8px rgba(0,0,0,.05)':'none' }}>
            ▧ 배경
          </button>
        </div>

        {editTab==='stickers' ? <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <strong style={{fontSize:12}}>스티커 보관함</strong>
            <span className="hint">{stickers.length}개</span>
          </div>
          <p className="hint" style={{fontSize:10.5, margin:'0 0 10px'}}>＋에서 스티커를 추가하고, 보관함의 스티커는 여러 번 꺼내 쓸 수 있어요.</p>
          {stickers.length===0 ? <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
            <label style={{minHeight:118,border:'1px dashed var(--line)',borderRadius:12,display:'grid',placeItems:'center',textAlign:'center',cursor:'pointer',background:'var(--bg)',color:'var(--faint)',fontSize:11}}>
              <span><span style={{display:'grid',placeItems:'center',width:34,height:34,margin:'0 auto 6px',border:'1px solid var(--line)',borderRadius:999,fontSize:20}}>＋</span>스티커 추가</span>
              <input type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0]; e.target.value=''; if(f) void addStickerToLibrary(f); }} />
            </label>
          </div> :
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
              <label style={{minHeight:118,border:'1px dashed var(--line)',borderRadius:12,display:'grid',placeItems:'center',textAlign:'center',cursor:'pointer',background:'var(--bg)',color:'var(--faint)',fontSize:11}}>
                <span><span style={{display:'grid',placeItems:'center',width:34,height:34,margin:'0 auto 6px',border:'1px solid var(--line)',borderRadius:999,fontSize:20}}>＋</span>새 스티커</span>
                <input type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0]; e.target.value=''; if(f) void addStickerToLibrary(f); }} />
              </label>
              {stickers.map(x=><StickerLibraryCard key={x.id} sticker={x} onAdd={() => addStickerToRoom(x.imgId)} onRemove={() => removeStickerFromLibrary(x.id)}/>)}
            </div>}
        </> : <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
            <strong style={{fontSize:12}}>ROOM 배경</strong>
            <span className="hint">4 : 3</span>
          </div>
          <p className="hint" style={{fontSize:10.5, margin:'0 0 10px'}}>방에 어울리는 배경을 골라보세요. 800×600으로 저장해서 선명하게 보여줘요.</p>
          <label className="btn btn-ghost" style={{ width:'100%', justifyContent:'center', marginBottom:8 }}>
            ▧ 배경 바꾸기
            <input type="file" accept="image/*" hidden onChange={e => { const f=e.target.files?.[0]; e.target.value=''; if(f) setBackgroundCropFile(f); }} />
          </label>
          {bgSrc ? <div style={{ border:'1px solid var(--line)', borderRadius:10, overflow:'hidden', background:'var(--bg)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgSrc} alt="현재 ROOM 배경" style={{ display:'block', width:'100%', aspectRatio:'4 / 3', objectFit:'cover' }} />
          </div> :
          <div style={{padding:24, textAlign:'center', border:'1px dashed var(--line)', borderRadius:10, fontSize:11, color:'var(--faint)'}}>아직 배경이 없어요.<br/>이미지를 추가해보세요.</div>}
        </>}
      </aside>}
      </div>
{profileEditOn && !editOn && <div style={{ position:'fixed', inset:0, zIndex:900, background:'rgba(20,18,15,.42)', display:'grid', placeItems:'center', padding:20 }}>
        <div className="panel" style={{ width:'min(430px,94vw)', padding:18, borderRadius:16, boxShadow:'0 18px 50px rgba(0,0,0,.18)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div><div style={{fontSize:9,letterSpacing:'.15em',color:'var(--faint)'}}>PROFILE</div><strong style={{fontSize:17}}>프로필 편집</strong></div>
            <button type="button" className="btn btn-ghost" onClick={()=>{setProfileEditOn(false);setProfileFile(null);}}>닫기</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:18, alignItems:'start' }}>
            <div>
              <div style={{ width:'100%', aspectRatio:'4 / 3', borderRadius:10, overflow:'hidden', border:'1px solid var(--line)', background:profileColor }}>
                {profilePreview ? <img src={profilePreview} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : user?.avatarUrl ? <RoomProfileImage id={user.avatarUrl}/> : null}
              </div>
              <label className="btn btn-ghost" style={{width:'100%',justifyContent:'center',marginTop:7,cursor:'pointer'}}>
                사진 변경
                <input type="file" accept="image/*" hidden onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)setProfileCropFile(f);}}/>
              </label>
            </div>
            <div style={{display:'grid',gap:10}}>
              <label style={{fontSize:10,color:'var(--faint)'}}>닉네임<input className="k-input" value={profileName} onChange={e=>setProfileName(e.target.value)} style={{width:'100%',boxSizing:'border-box',marginTop:4}}/></label>
              <label style={{fontSize:10,color:'var(--faint)'}}>이미지 없을 때 색상<input type="color" value={profileColor} onChange={e=>setProfileColor(e.target.value)} style={{display:'block',width:'100%',height:34,marginTop:4,border:0,background:'transparent',padding:0}}/></label>
            </div>
          </div>
          <label style={{display:'grid',gap:4,fontSize:10,color:'var(--faint)',marginTop:12}}>
            이름 폰트
            <select className="k-input" value={profileFont} onChange={e=>setProfileFont(e.target.value)}>
              {fonts.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <div style={{display:'flex',justifyContent:'flex-end',gap:6,marginTop:16}}>
            <button type="button" className="btn btn-ghost" onClick={()=>{setProfileEditOn(false);setProfileFile(null);}}>취소</button>
            <button type="button" className="btn btn-dark" onClick={()=>void saveProfile()}>저장</button>
          </div>
        </div>
      </div>}
      {profileCropFile && <ProfileCropper file={profileCropFile} onCancel={()=>setProfileCropFile(null)} onDone={file=>{setProfileCropFile(null);setProfileFile(file);}} />}
      <p className="hint" style={{ marginTop:8, visibility:editOn ? 'visible' : 'hidden' }}>보관함에서 스티커를 여러 번 꺼내 쓸 수 있어요. 방에서 삭제해도 보관함에는 남습니다.</p>
      {backgroundCropFile && <BackgroundCropper file={backgroundCropFile} onCancel={()=>setBackgroundCropFile(null)} onDone={async file=>{setBackgroundCropFile(null);await addBackground(file);}} />}
    </section>
  );
}
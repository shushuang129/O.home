'use client';
// 회원정보창 (고정 요소, 4.0) — 비로그인: 로그인 버튼만 (위젯 크기 유지 · 폼은 /login 페이지)
// 로그인: 프로필 요약 + 마이페이지/로그아웃
import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useBlobUrl } from '@/lib/blobStore';

export function MemberBox() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const avatarSrc = useBlobUrl(user?.avatarUrl);

  return (
    <div className="panel login-box profile-diary-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="profile-card-head">
        <span className="profile-card-label">PROFILE</span>
        <span className="profile-card-mark">✦</span>
      </div>
      {user ? (
        <>
          <div className="profile-main">
            <div className="profile-avatar">
              {/* 기본 아바타는 이니셜 없이 단색/그라데이션 */}
              <div style={{
                width: '100%', height: '100%', overflow: 'hidden',
                background: avatarSrc ? undefined : (user.avatarColor ?? 'linear-gradient(135deg,#6b7280,#3c434d)'),
              }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
                {avatarSrc && <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
            </div>
            <div className="profile-name">
              <b>{user.nickname}</b>
              <small>{user.role === 'admin' ? 'ADMIN' : 'MEMBER'}</small>
            </div>
          </div>
          <p className="profile-note">welcome to my little archive.</p>
          <div className="profile-actions">
            <button className="btn btn-ghost" onClick={() => router.push('/mypage')}>MY PAGE</button>
            <button className="btn btn-ghost" onClick={logout}>LOG OUT</button>
          </div>
          <div className="mini-player" aria-label="BGM decoration">
            <div className="mini-player-top">
              <span>NOW PLAYING</span>
              <i>♪</i>
            </div>
            <div className="mini-player-title">my little playlist</div>
            <div className="mini-player-track"><i /></div>
            <div className="mini-player-controls"><span>◂◂</span><b>▶</b><span>▸▸</span></div>
          </div>
        </>
      ) : (
        /* 비로그인 — 남는 높이 안에서 세로 가운데 정렬 (v1.9) */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: '0 0 12px', lineHeight: 1.6 }}>
            로그인 후 멤버 전용 콘텐츠를 열람할 수 있습니다
          </p>
          <button className="btn btn-dark" style={{ width: '100%', justifyContent: 'center', padding: 10 }}
            onClick={() => router.push('/login')}>로그인</button>
        </div>
      )}
    </div>
  );
}

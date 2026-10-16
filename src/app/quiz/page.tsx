'use client';
import React, { useEffect, useRef, useState } from 'react';
import styles from './quiz.module.css';
import { getSetting, onSettingChange, QUIZ_BONUS_URL_KEY } from '@/lib/settingStore';

type Question = { title: string; answers: string[]; audio: string };

// 시작 화면 중앙 문구는 이 세 항목만 바꾸면 수정할 수 있어요.
const HERO_LABEL = 'MUSIC QUIZ!';
const HERO_TITLE = '역재생 듣고 맞히기';
const HERO_SUBTITLE = '— LISTEN & GUESS QUIZ —';
const QUESTIONS: Question[] = [
  { title: '짝사랑', answers: ['카타오모이'], audio: '/song/song01.mp3' },
  { title: '좋아하니까', answers: ['스키다카라'], audio: '/song/song02.mp3' },
  { title: 'w/x/y', answers: ['wxy'], audio: '/song/song03.mp3' },
  { title: '히로인', answers: ['히로인'], audio: '/song/song04.mp3' },
];
function normalize(value: string) { return value.normalize('NFKC').toLocaleLowerCase().replace(/[\\s\\u3000"'“”‘’「」『』【】()[\\]{}.,!?！？・:：~〜—–_-]/g, ''); }
function shuffledOrder() { return [...QUESTIONS.keys()].sort(() => Math.random() - 0.5); }

export default function QuizPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  const [order, setOrder] = useState<number[]>(() => [...QUESTIONS.keys()]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ title: string; correct: boolean }[]>([]);
  const [finished, setFinished] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [bonusUrl, setBonusUrl] = useState('');
  const question = QUESTIONS[order[index] ?? 0];

  useEffect(() => {
    setBonusUrl(getSetting<string>(QUIZ_BONUS_URL_KEY, ''));
    return onSettingChange(key => {
      if (key === QUIZ_BONUS_URL_KEY) setBonusUrl(getSetting<string>(QUIZ_BONUS_URL_KEY, ''));
    });
  }, []);

  useEffect(() => {
    setInput(''); setChecked(false); setFeedback(''); setPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.load(); }
  }, [index, order]);

  const start = () => {
    if (audioRef.current) audioRef.current.pause();
    setOrder(shuffledOrder()); setIndex(0); setInput(''); setChecked(false);
    setScore(0); setResults([]); setFinished(false); setFeedback(''); setStarted(true);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checked || !input.trim()) return;
    const correct = [question.title, ...question.answers].some(a => normalize(a) === normalize(input));
    if (!correct) {
      setFeedback('틀렸어요! 다시 입력해 보세요.');
      setInput('');
      return;
    }
    setChecked(true);
    setFeedback('정답!');
    setScore(s => s + 1);
    setResults(r => [...r, { title: question.title, correct: true }]);
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
    // 마지막 문제까지 정답이면 결과 확인 버튼 없이 축하 화면으로 바로 전환
    if (index === QUESTIONS.length - 1) setFinished(true);
  };
  const next = () => { if (index < QUESTIONS.length - 1) setIndex(i => i + 1); else setFinished(true); };

  return <section className={['page', styles.page].join(' ')}>
    <div className={styles.grid} aria-hidden="true" />
    {!started ? <>
      <main className={styles.hero}>
        <span className={styles.heroCorner} aria-hidden="true" />
        <span className={styles.heroLabel}>{HERO_LABEL}</span>
        <h1>{HERO_TITLE}</h1>
        <p>{HERO_SUBTITLE}</p>
      </main>
      <button className={styles.startButton} type="button" onClick={start}>
        <span className={styles.buttonNumber}><span className={styles.numberLabel}>01</span></span>
        <span className={styles.buttonChevrons} aria-hidden="true">›››</span>
        <span className={styles.buttonCopy}><strong>QUIZ START</strong></span>
        <span className={styles.buttonTarget} aria-hidden="true">
          <svg viewBox="0 0 36 36" focusable="false">
            <circle cx="18" cy="18" r="13.5" />
            <circle cx="18" cy="18" r="8.2" />
            <circle cx="18" cy="18" r="2.8" />
            <path d="M18 1.5v6 M18 28.5v6 M1.5 18h6 M28.5 18h6" />
            <path d="M6.3 6.3l4.2 4.2 M25.5 25.5l4.2 4.2 M29.7 6.3l-4.2 4.2 M10.5 25.5l-4.2 4.2" opacity=".5" />
          </svg>
        </span>
      </button>
    </> : <main className={styles.canvas}>
      <header className={styles.heading}><span className={styles.kicker}>LISTEN &amp; GUESS</span><h1>퀴즈</h1><span className={styles.rule} /></header>
      <section className={styles.quizPanel} aria-live="polite">
        {!finished ? <>
          <div className={styles.topline}><span>QUESTION <b>{String(index + 1).padStart(2, '0')}</b> / {String(QUESTIONS.length).padStart(2, '0')}</span><span className={styles.progressText}>{Math.round((index + (checked ? 1 : 0)) / QUESTIONS.length * 100)}%</span></div>
          <div className={styles.progress}><span style={{ width: ((index + (checked ? 1 : 0)) / QUESTIONS.length * 100) + '%' }} /></div>
          <h2 className={styles.questionTitle}>이 노래의 제목은?</h2>
          <div className={styles.audioRow}>
            <div className={[styles.record, playing ? styles.spinning : ''].join(' ')} aria-hidden="true"><span /></div>
            <audio ref={audioRef} className={styles.audio} controls preload="metadata" src={question.audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
          </div>
          {!checked ? <>
            <form className={styles.answerForm} onSubmit={submit}>
              <input aria-label="노래 제목 입력" value={input} onChange={e => setInput(e.target.value)} placeholder="노래 제목을 입력하세요" autoComplete="off" required />
              <button type="submit">확인</button>
            </form>
            {feedback && <div className={styles.feedback} role="status"><span>{feedback}</span></div>}
          </> : <div className={styles.feedback}><span>{feedback}</span><button type="button" onClick={next}>다음 문제</button></div>}
        </> : <div className={styles.celebration} role="status" aria-live="polite">
          <span className={styles.firework} aria-hidden="true" />
          <span className={[styles.firework, styles.fireworkSecond].join(' ')} aria-hidden="true" />
          <span className={[styles.firework, styles.fireworkThird].join(' ')} aria-hidden="true" />
          <div className={styles.confetti} aria-hidden="true">
            {Array.from({ length: 36 }, (_, i) => (
              <span
                key={i}
                className={styles.confettiPiece}
                style={{
                  '--piece-left': `${(i * 37 + 7) % 100}%`,
                  '--fall-delay': `${-((i % 11) * 0.19)}s`,
                  '--fall-duration': `${2.2 + (i % 5) * 0.32}s`,
                } as React.CSSProperties}
              />
            ))}
          </div>
          <span className={styles.celebrationLabel}>PERFECT CLEAR!</span>
          <h2>다 맞췄다!</h2>
          <p className={styles.celebrationLead}>모든 문제를 맞혔어요!</p>
          <p className={styles.celebrationScore}><strong>{score}</strong><span> / {QUESTIONS.length}</span></p>
          <div className={styles.celebrationSongs}>
            {results.map((r, i) => <span className={styles.songTag} key={i}>✓ {r.title}</span>)}
          </div>
          <div className={styles.celebrationActions}>
            <button className={styles.againButton} type="button" onClick={start}>다시 풀기 ↻</button>
            {bonusUrl ? (
              <a className={styles.bonusButton} href={bonusUrl} target="_blank" rel="noopener noreferrer">정답특전 ↗</a>
            ) : (
              <button className={[styles.bonusButton, styles.bonusButtonDisabled].join(' ')} type="button" disabled
                title="환경설정의 퀴즈 탭에서 유튜브 링크를 등록해 주세요">정답특전</button>
            )}
          </div>
        </div>}
      </section>
    </main>}
  </section>;
}

'use client';
import React, { useEffect, useRef, useState } from 'react';
import styles from './quiz.module.css';

type Question = { title: string; answers: string[]; audio: string };
const QUESTIONS: Question[] = [
  { title: '노래 제목 1', answers: ['노래 제목 1'], audio: '/song/song01.mp3' },
  { title: '노래 제목 2', answers: ['노래 제목 2'], audio: '/song/song02.mp3' },
  { title: '노래 제목 3', answers: ['노래 제목 3'], audio: '/song/song03.mp3' },
];
function normalize(value: string) { return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000"'“”‘’「」『』【】()[\]{}.,!?！？・:：~〜—–_-]/g, ''); }
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
  const question = QUESTIONS[order[index] ?? 0];

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
    setChecked(true); setFeedback(correct ? '정답!' : '정답: ' + question.title);
    if (correct) setScore(s => s + 1);
    setResults(r => [...r, { title: question.title, correct }]);
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
  };
  const next = () => { if (index < QUESTIONS.length - 1) setIndex(i => i + 1); else setFinished(true); };

  return <section className={['page', styles.page].join(' ')}>
    <div className={styles.grid} aria-hidden="true" />
    <main className={styles.canvas}>
      <header className={styles.heading}><span className={styles.kicker}>LISTEN &amp; GUESS</span><h1>퀴즈</h1><span className={styles.rule} /></header>
      {!started ? <section className={styles.startPanel}>
        <p className={styles.startMark}>♫</p>
        <button className={styles.startButton} type="button" onClick={start}>퀴즈 풀기 <span>↗</span></button>
      </section> : <section className={styles.quizPanel} aria-live="polite">
        {!finished ? <>
          <div className={styles.topline}><span>QUESTION <b>{String(index + 1).padStart(2, '0')}</b> / {String(QUESTIONS.length).padStart(2, '0')}</span><span className={styles.progressText}>{Math.round((index + (checked ? 1 : 0)) / QUESTIONS.length * 100)}%</span></div>
          <div className={styles.progress}><span style={{ width: ((index + (checked ? 1 : 0)) / QUESTIONS.length * 100) + '%' }} /></div>
          <h2 className={styles.questionTitle}>이 노래의 제목은?</h2>
          <div className={styles.audioRow}>
            <div className={[styles.record, playing ? styles.spinning : ''].join(' ')} aria-hidden="true"><span /></div>
            <audio ref={audioRef} className={styles.audio} controls preload="metadata" src={question.audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
          </div>
          {!checked ? <form className={styles.answerForm} onSubmit={submit}>
            <input aria-label="노래 제목 입력" value={input} onChange={e => setInput(e.target.value)} placeholder="노래 제목을 입력하세요" autoComplete="off" required />
            <button type="submit">확인 ↗</button>
          </form> : <div className={styles.feedback}><span>{feedback}</span><button type="button" onClick={next}>{index === QUESTIONS.length - 1 ? '결과 보기' : '다음 문제'} ↗</button></div>}
        </> : <div className={styles.result}>
          <p className={styles.resultLabel}>QUIZ COMPLETED</p><h2>결과</h2><p className={styles.score}>{score}<span> / {QUESTIONS.length}</span></p>
          <div className={styles.review}>{results.map((r, i) => <div className={styles.reviewRow} key={i}><span>문제 {i + 1}</span><b>{r.correct ? '정답' : '오답'}</b></div>)}</div>
          <button className={styles.againButton} type="button" onClick={start}>다시 풀기 ↻</button>
        </div>}
      </section>}
    </main>
  </section>;
}

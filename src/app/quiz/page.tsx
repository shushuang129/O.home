'use client';
import React, { useEffect, useRef, useState } from 'react';
import styles from './quiz.module.css';
type Question = { title: string; answers: string[]; audio: string };
const QUESTIONS: Question[] = [
  { title: '노래 제목 1', answers: ['노래 제목 1'], audio: '/song-quiz/assets/songs/song01.mp3' },
  { title: '노래 제목 2', answers: ['노래 제목 2'], audio: '/song-quiz/assets/songs/song02.mp3' },
  { title: '노래 제목 3', answers: ['노래 제목 3'], audio: '/song-quiz/assets/songs/song03.mp3' },
];
function normalize(value: string) { return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\u3000"'“”‘’「」『』【】()[\]{}.,!?！？・:：~〜—–_-]/g, ''); }
function shuffledOrder() { return [...QUESTIONS.keys()].sort(() => Math.random() - 0.5); }
export default function QuizPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [order, setOrder] = useState<number[]>(() => [...QUESTIONS.keys()]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<{ title: string; answer: string; correct: boolean }[]>([]);
  const [finished, setFinished] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioStatus, setAudioStatus] = useState('재생 버튼을 눌러 노래를 들어보세요.');
  const [feedback, setFeedback] = useState('');
  const question = QUESTIONS[order[index] ?? 0];
  useEffect(() => {
    setInput(''); setChecked(false); setFeedback('');
    setAudioStatus('재생 버튼을 눌러 노래를 들어보세요.'); setPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.load(); }
  }, [index, order]);
  const startOver = () => {
    if (audioRef.current) audioRef.current.pause();
    setOrder(shuffledOrder()); setIndex(0); setInput(''); setChecked(false);
    setScore(0); setResults([]); setFinished(false); setPlaying(false); setFeedback('');
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checked || !input.trim()) return;
    const correct = [question.title, ...question.answers].some(a => normalize(a) === normalize(input));
    setChecked(true); setFeedback(correct ? '정답입니다!' : '아쉬워요. 정답은 「' + question.title + '」입니다.');
    if (correct) setScore(s => s + 1);
    setResults(r => [...r, { title: question.title, answer: input.trim(), correct }]);
    if (audioRef.current) audioRef.current.pause();
    setPlaying(false);
  };
  const next = () => { if (index < QUESTIONS.length - 1) setIndex(i => i + 1); else setFinished(true); };
  return <section className={['page', styles.page].join(' ')}>
    <div className={styles.grid} aria-hidden="true" /><div className={styles.fade} aria-hidden="true" />
    <main className={styles.canvas}>
      <div className={styles.decoTopLeft}><span className={styles.badge}>OC</span><span className={styles.topLabel}>ORIGINAL CHARACTER ARCHIVE</span><span className={styles.topLine} /></div>
      <div className={styles.decoTopRight}><span className={styles.miniChev}><i /><i /><i /></span><span>QUIZ / 2026</span></div>
      <div className={styles.decoSide}><span className={styles.sideDot} /><span className={styles.sideText}>LISTEN CAREFULLY</span><span className={styles.sideLine} /></div>
      <section className={styles.decoInfo}><h2 className={styles.infoHeading}>SONG ARCHIVE</h2><span className={styles.infoRule} /><p className={styles.infoText}>음원을 듣고 노래 제목을 맞혀 보세요.<br />총 3문제가 준비되어 있습니다.</p></section>
      <header className={styles.titleArea}><div className={styles.titleInner}>
        <i className={[styles.corner, styles.tl].join(' ')} /><i className={[styles.corner, styles.tr].join(' ')} /><i className={[styles.corner, styles.bl].join(' ')} /><i className={[styles.corner, styles.br].join(' ')} />
        <p className={styles.titleTag}>SONG TITLE</p><h1 className={styles.titleText}>퀴즈</h1><p className={styles.titleSub}><span>LISTEN &amp; GUESS</span></p>
      </div></header>
      <section className={styles.quizPanel} aria-live="polite">
        {!finished ? <>
          <div className={styles.quizTopline}><span className={styles.quizLabel}>QUESTION <b>{String(index + 1).padStart(2, '0')}</b> / {String(QUESTIONS.length).padStart(2, '0')}</span><button type="button" className={styles.resetButton} onClick={startOver}>↻ 처음부터</button></div>
          <div className={styles.progress}><span style={{ width: ((index + (checked ? 1 : 0)) / QUESTIONS.length * 100) + '%' }} /></div>
          <h2 className={styles.questionTitle}>이 노래의 제목은?</h2>
          <div className={styles.audioBox}>
            <div className={[styles.record, playing ? styles.spinning : ''].join(' ')} aria-hidden="true"><span /></div>
            <div className={styles.audioContent}><p className={styles.audioLabel}>NOW PLAYING / UNKNOWN TRACK</p><p className={styles.unknown}>UNKNOWN TRACK</p><p className={styles.help}>음원을 듣고 노래 제목을 입력해 주세요.</p>
              <audio ref={audioRef} className={styles.audio} controls preload="metadata" src={question.audio}
                onPlay={() => { setPlaying(true); setAudioStatus('재생 중입니다.'); }} onPause={() => setPlaying(false)}
                onEnded={() => { setPlaying(false); setAudioStatus('재생이 끝났습니다. 다시 들을 수 있어요.'); }}
                onCanPlay={() => setAudioStatus('음원을 재생할 수 있어요.')}
                onError={() => setAudioStatus('음원 파일을 찾을 수 없어요. GitHub의 public/song-quiz/assets/songs 폴더에 MP3를 넣어주세요.')} />
              <p className={styles.audioStatus}>{audioStatus}</p>
              <button type="button" className={styles.replay} onClick={() => { const audio = audioRef.current; if (!audio) return; audio.currentTime = 0; void audio.play().catch(() => setAudioStatus('재생할 수 없어요. MP3 파일 경로를 확인해 주세요.')); }}>↻ 처음부터 다시 듣기</button>
            </div>
          </div>
          {!checked ? <form className={styles.answerForm} onSubmit={submit}>
            <label htmlFor="song-answer"><span>YOUR ANSWER</span><span>노래 제목</span></label>
            <div className={styles.answerRow}><input id="song-answer" value={input} onChange={e => setInput(e.target.value)} placeholder="노래 제목을 입력하세요" autoComplete="off" required /><button type="submit">정답 제출 ↗</button></div>
            <p className={styles.note}>띄어쓰기와 대소문자는 정답 판정에서 무시됩니다.</p>
          </form> : <div className={styles.feedback}><p>{feedback}</p><button type="button" className={styles.nextButton} onClick={next}>{index === QUESTIONS.length - 1 ? '결과 보기 →' : '다음 문제 →'}</button></div>}
        </> : <div className={styles.result}><p className={styles.resultKicker}>QUIZ COMPLETED</p><h2 className={styles.questionTitle}>결과</h2><p className={styles.score}><strong>{score}</strong> / {QUESTIONS.length}</p>
          <p className={styles.resultMessage}>{score === QUESTIONS.length ? '완벽해요! 모든 문제를 맞혔습니다.' : '수고했어요. 다시 도전해 보세요.'}</p>
          <div className={styles.review}>{results.map((r, i) => <div className={styles.reviewRow} key={i}><span>{String(i + 1).padStart(2, '0')}　{r.title}</span><b>{r.correct ? 'CORRECT' : 'MISSED'}</b></div>)}</div>
          <button type="button" className={styles.nextButton} onClick={startOver}>다시 도전하기 ↻</button>
        </div>}
      </section>
    </main>
  </section>;
}

/* 음원 파일은 public/song-quiz/assets/songs/ 에 넣으세요.
   기본 파일명: song01.mp3, song02.mp3, song03.mp3.
   아래 title/answers를 실제 노래 제목과 허용 답안으로 바꿔 주세요. */
const questions = [
  { title: "노래 제목 1", audio: "/song-quiz/assets/songs/song01.mp3", answers: ["노래 제목 1"] },
  { title: "노래 제목 2", audio: "/song-quiz/assets/songs/song02.mp3", answers: ["노래 제목 2"] },
  { title: "노래 제목 3", audio: "/song-quiz/assets/songs/song03.mp3", answers: ["노래 제목 3"] }
];
const $ = (s) => document.querySelector(s);
const app = $("#app"), quizScreen = $("#quiz-screen"), resultScreen = $("#result-screen"), audio = $("#audio-player");
let order = [], current = 0, score = 0, answered = false, review = [];
function normalize(v) { return String(v ?? "").normalize("NFKC").toLocaleLowerCase().replace(/[\s\u3000"'“”‘’「」『』【】()[\]{}.,!?！？・:：~〜—–_-]/g, ""); }
function shuffle(a) { const x = [...a]; for (let i=x.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; } return x; }
function setQuizVisible(on) { quizScreen.hidden=!on; app.style.display=on?"none":""; window.scrollTo(0,0); }
function showQuiz() { $("#answer-form").hidden=false; $("#feedback").hidden=true; $("#next-btn").hidden=true; resultScreen.hidden=true; $("#audio-status").textContent="재생 버튼을 눌러 노래를 들어보세요."; setQuizVisible(true); }
function startQuiz() { order=shuffle([0,1,2]); current=0; score=0; review=[]; showQuiz(); renderQuestion(); }
function renderQuestion() {
  answered=false; const q=questions[order[current]];
  $("#current-count").textContent=String(current+1).padStart(2,"0"); $("#progress-bar").style.width=(current/3*100)+"%";
  $("#feedback").hidden=true; $("#next-btn").hidden=true; $("#answer-form").hidden=false; $("#answer-input").disabled=false; $("#answer-input").value="";
  audio.pause(); audio.removeAttribute("src"); audio.load(); audio.src=q.audio; audio.load();
  $("#audio-status").textContent="음원을 불러오는 중입니다.";
}
audio.addEventListener("play",()=>document.body.classList.add("is-quiz-playing"));
audio.addEventListener("pause",()=>document.body.classList.remove("is-quiz-playing"));
audio.addEventListener("ended",()=>document.body.classList.remove("is-quiz-playing"));
audio.addEventListener("error",()=>{if(audio.currentSrc) $("#audio-status").textContent="음원 파일을 찾거나 재생할 수 없어요. 파일 경로를 확인해 주세요: "+(questions[order[current]]?.audio||"");});
audio.addEventListener("canplay",()=>{$("#audio-status").textContent="음원을 재생할 수 있어요.";});
$("#app").addEventListener("click",e=>{const link=e.target.closest('a.menu-link[href="#quiz"]');if(!link)return;e.preventDefault();startQuiz();});
$("#home-btn").addEventListener("click",()=>{audio.pause();setQuizVisible(false);});
$("#replay-btn").addEventListener("click",()=>{audio.currentTime=0;audio.play().catch(()=>{$("#audio-status").textContent="재생할 수 없어요. MP3 파일 경로를 확인해 주세요.";});});
$("#answer-form").addEventListener("submit",e=>{
  e.preventDefault();if(answered)return;const value=$("#answer-input").value.trim();if(!value)return;answered=true;
  const q=questions[order[current]], correct=[q.title,...(q.answers||[])].some(a=>normalize(a)===normalize(value));
  if(correct)score++;review.push({title:q.title,selected:value,correct});$("#answer-input").disabled=true;$("#answer-form").hidden=true;
  $("#feedback").textContent=correct?"정답입니다! 다음 문제로 넘어가세요.":`아쉬워요. 정답은 「${q.title}」입니다.`;
  $("#feedback").hidden=false;$("#next-btn").textContent=current===2?"결과 보기 →":"다음 문제 →";$("#next-btn").hidden=false;$("#progress-bar").style.width=((current+1)/3*100)+"%";
});
function showResult(){
  audio.pause();$("#final-score").textContent=score;
  $("#result-message").textContent=score===3?"완벽해요. 세 곡의 제목을 모두 맞혔습니다.":score===2?"훌륭해요! 한 번 더 도전해 볼까요?":"다시 듣고 한 번 더 도전해 보세요.";
  const box=$("#answer-review");box.replaceChildren();
  review.forEach((r,i)=>{const row=document.createElement("div");row.className="quiz-review-row";const left=document.createElement("span");left.textContent=`${String(i+1).padStart(2,"0")}　${r.title}${r.correct?"":` · 입력한 답: ${r.selected}`}`;const right=document.createElement("span");right.textContent=r.correct?"CORRECT":"MISSED";row.append(left,right);box.append(row);});
  $("#progress-bar").style.width="100%";$("#answer-form").hidden=true;$("#feedback").hidden=true;$("#next-btn").hidden=true;resultScreen.hidden=false;
}
$("#next-btn").addEventListener("click",()=>{if(current<2){current++;renderQuestion();}else showResult();});
$("#restart-btn").addEventListener("click",()=>{audio.pause();setQuizVisible(false);});

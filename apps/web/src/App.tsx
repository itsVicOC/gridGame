import { useEffect, useState } from "react";
import { evaluateRun, practicePuzzles, type GameState, type MoveLog, type PuzzleDefinition } from "@pathweave/game";
import { BookOpen, Flame, Globe2, LockKeyhole, Settings, Share2, Star, Trophy, WifiOff, X } from "lucide-react";
import { api, CLIENT_VERSION, type StarDetails } from "./api";
import { GameBoard } from "./GameBoard";
import { Leaderboard } from "./Leaderboard";
import { downloadPoster } from "./SharePoster";
import { useIdentity } from "./useIdentity";
import { useOnline } from "./useOnline";
import { useDialogFocus } from "./useDialogFocus";

interface Result { stars: number; steps: number; durationMs: number; starDetails: StarDetails; accepted?: boolean; improved?: boolean; rejectionReason?: string; dailyRank?: number; seasonRank?: number }
interface PendingSubmission { attemptId: string; attemptToken: string; idempotencyKey: string; moves: GameState["moves"]; operationLog: MoveLog[] }

export function goalStates(result?: Pick<Result, "starDetails">) {
  return {
    completion: Boolean(result?.starDetails.completion),
    optimal: Boolean(result?.starDetails.optimal),
    challenge: Boolean(result?.starDetails.challenge),
  };
}

export function isVersionSupported(current: string, minimum: string) {
  const parts = (value: string) => value.split(".").map((part) => Number(part));
  const currentParts = parts(current); const minimumParts = parts(minimum);
  for (let index = 0; index < 3; index++) {
    if ((currentParts[index] ?? 0) !== (minimumParts[index] ?? 0)) return (currentParts[index] ?? 0) > (minimumParts[index] ?? 0);
  }
  return true;
}

export default function App() {
  const online = useOnline();
  const identity = useIdentity();
  const [date, setDate] = useState(""); const [puzzle, setPuzzle] = useState<PuzzleDefinition>();
  const [view, setView] = useState<"today" | "practice">("today"); const [practiceIndex, setPracticeIndex] = useState(0);
  const [attempt, setAttempt] = useState<{ attemptId: string; attemptToken: string }>();
  const [result, setResult] = useState<Result>(); const [showBoard, setShowBoard] = useState(false); const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState<string>(); const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false); const [submitting, setSubmitting] = useState(false); const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission>();
  const currentPuzzle = view === "practice" ? practicePuzzles[practiceIndex] : puzzle;
  const goals = goalStates(result);
  const streak = identity.streak;

  useEffect(() => {
    if (!online) { setLoading(false); return; }
    api.today().then(({ date: nextDate, puzzle: nextPuzzle, minClientVersion }) => {
      if (!isVersionSupported(CLIENT_VERSION, minClientVersion)) throw new Error("游戏规则已更新，请刷新页面后继续");
      setDate(nextDate); setPuzzle(nextPuzzle);
    }).catch((error: Error) => setNotice(error.message)).finally(() => setLoading(false));
  }, [online]);

  useEffect(() => { if (identity.error) setNotice(identity.error); }, [identity.error]);

  async function startToday() {
    setResult(undefined); setAttempt(undefined); setNotice(undefined);
    if (view === "practice") return;
    if (!online) { setNotice("每日排行需要联网；练习关仍可离线游玩。 "); return; }
    setStarting(true);
    try { setAttempt(await api.start()); } catch (error) { setNotice((error as Error).message); }
    finally { setStarting(false); }
  }

  async function submitRun(submission: PendingSubmission) {
    setSubmitting(true); setNotice(undefined); setPendingSubmission(submission);
    try {
      const response = await api.submit(submission.attemptId, submission);
      setResult({ ...response.result, accepted: response.accepted, improved: response.improved });
      setPendingSubmission(undefined);
      let dailyRank: number | undefined; let seasonRank: number | undefined;
      if (response.accepted && identity.player) {
        await identity.refreshProfile().catch(() => undefined);
        try {
          const [daily, season] = await Promise.all([api.dailyBoard(date), api.seasonBoard(date.slice(0, 7))]);
          dailyRank = [...daily.top, ...daily.nearby].find((row) => row.id === identity.player!.id)?.rank;
          seasonRank = [...season.top, ...season.nearby].find((row) => row.id === identity.player!.id)?.rank;
          setResult({ ...response.result, accepted: response.accepted, improved: response.improved, dailyRank, seasonRank });
        } catch { setNotice("成绩已写入，名次暂时无法刷新。"); }
      }
    } catch (error) { setNotice(`${(error as Error).message}，可以重试提交。`); }
    finally { setSubmitting(false); }
  }

  async function complete(state: GameState, log: MoveLog[], elapsedMs: number) {
    if (!currentPuzzle) return;
    const local = evaluateRun(currentPuzzle, state, elapsedMs);
    if (view === "practice") {
      setResult({ stars: local.stars, starDetails: local.starDetails, steps: local.steps, durationMs: elapsedMs, accepted: true });
      localStorage.setItem("pathweave-practice", String(Math.max(practiceIndex + 1, Number(localStorage.getItem("pathweave-practice") ?? 0))));
      return;
    }
    if (!attempt) { setNotice("这局没有有效的正式尝试令牌，请重新开始。"); return; }
    await submitRun({ attemptId: attempt.attemptId, attemptToken: attempt.attemptToken, idempotencyKey: crypto.randomUUID(), moves: state.moves, operationLog: log });
  }

  const difficulty = currentPuzzle ? "●".repeat(currentPuzzle.difficulty) + "○".repeat(5 - currentPuzzle.difficulty) : "";
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="." aria-label="纸径首页"><span className="brand-mark">径</span><span><b>纸径</b><small>DAILY PATH</small></span></a><div className="header-actions"><span className={`network-pill ${online ? "" : "offline"}`}>{online ? <Globe2 size={15}/> : <WifiOff size={15}/>} {online ? "全球同步" : "离线"}</span><button className="icon-button" onClick={() => setShowSettings(true)} aria-label="设置"><Settings /></button></div></header>
    <main>
      <section className="hero"><div><p className="eyebrow">{date || "今日"} · 北京时间</p><h1>每天一条路，<br/><em>串起所有线索。</em></h1><p className="hero-copy">在不重复的路径里连接起点与终点。两三分钟，让思绪安静下来。</p></div><div className="streak-card"><Flame/><b>{streak}</b><span>连续天数</span></div></section>
      {notice && <div className="notice" role="alert"><span>{notice}</span><span>{pendingSubmission && <button className="retry-button" onClick={() => submitRun(pendingSubmission)} disabled={submitting}>{submitting ? "提交中…" : "重试提交"}</button>}<button aria-label="关闭提示" onClick={() => setNotice(undefined)}><X size={16}/></button></span></div>}
      <nav className="main-tabs"><button className={view === "today" ? "active" : ""} onClick={() => { setView("today"); setResult(undefined); }}><Star size={18}/>今日谜题</button><button className={view === "practice" ? "active" : ""} onClick={() => { setView("practice"); setResult(undefined); }}><BookOpen size={18}/>练习册</button></nav>
      {loading || identity.loading ? <div className="loading-card">正在铺开今天的纸张…</div> : currentPuzzle ? <div className="play-layout">
        <aside className="puzzle-card"><div className="puzzle-card-top"><span className="paper-tag">{view === "today" ? "今日限定" : `练习 ${practiceIndex + 1}/12`}</span><span className="difficulty" aria-label={`难度 ${currentPuzzle.difficulty} 星`}>{difficulty}</span></div><h2>{currentPuzzle.title}</h2><p>{currentPuzzle.width} × {currentPuzzle.height} 网格 · 最优 {currentPuzzle.optimalSteps} 步</p>{currentPuzzle.tutorial && <p className="tutorial-note">{currentPuzzle.tutorial}</p>}<div className="goals"><Goal active={goals.completion} icon="1" text="完成所有必经格"/><Goal active={goals.optimal} icon="2" text={`${currentPuzzle.optimalSteps} 步内完成`}/><Goal active={goals.challenge} icon="3" text={currentPuzzle.challenge.label}/></div>
          {view === "practice" ? <div className="practice-picker">{practicePuzzles.map((_, index) => <button key={index} className={index === practiceIndex ? "active" : ""} onClick={() => { setPracticeIndex(index); setResult(undefined); }}>{index + 1}</button>)}</div> : <button className="leaderboard-button" onClick={() => setShowBoard(true)}><Trophy size={18}/>查看全球排行榜</button>}
        </aside>
        <div className="board-column">{view === "practice" || attempt ? <GameBoard key={`${currentPuzzle.id}-${Boolean(result)}`} puzzle={currentPuzzle} disabled={Boolean(result) || submitting} onComplete={complete}/> : <div className="start-card"><span className="stamp-large">今日</span><h2>准备好写下第一笔？</h2><p>正式尝试记录实际操作时长，可无限重玩并刷新最佳成绩。</p><button className="primary-button" onClick={startToday} disabled={!online || !identity.player || starting}>{starting ? "正在领题…" : "开始挑战"}</button></div>}
          {submitting && <div className="submitting-card" role="status">正在校验路径并写入全球榜…</div>}
          {result && <section className="result-card"><p className="eyebrow">本次结果</p><h2 aria-label={`获得 ${result.stars} 颗星`}>{"★".repeat(result.stars)}{"☆".repeat(3 - result.stars)}</h2><p>{result.steps} 步 · {(result.durationMs / 1000).toFixed(1)} 秒</p>{result.dailyRank && <p>今日第 <b>{result.dailyRank}</b> 名 · 赛季第 <b>{result.seasonRank ?? "—"}</b> 名</p>}{result.accepted === false && <p className="error-note">{result.rejectionReason ?? "成绩未被接受"}</p>}{result.improved && <span className="improved-badge">刷新今日最佳</span>}<div className="result-actions"><button className="primary-button" onClick={() => { setResult(undefined); startToday(); }}>再试一次</button><button className="secondary-button" onClick={() => downloadPoster({ date, stars: result.stars, steps: result.steps, durationMs: result.durationMs, dailyRank: result.dailyRank, seasonRank: result.seasonRank, streak })}><Share2 size={17}/>分享海报</button></div></section>}
        </div>
      </div> : <div className="loading-card">每日题需要联网加载。你仍可打开练习册。</div>}
    </main>
    <footer><span>纸径 · 每日路径拼图</span><span>规则版本 1.1 · 北京时间每日更新</span></footer>
    {showBoard && date && <Leaderboard date={date} onClose={() => setShowBoard(false)}/>}
    {showSettings && <SettingsModal identity={identity} onClose={() => setShowSettings(false)}/>}
    {identity.recoveryCode && <RecoveryModal code={identity.recoveryCode} onClose={identity.clearRecovery}/>}
  </div>;
}

function Goal({ active, icon, text }: { active: boolean; icon: string; text: string }) { return <div className={active ? "goal active" : "goal"}><span>{icon}</span><p>{text}</p><Star size={17} fill={active ? "currentColor" : "none"}/></div>; }

function RecoveryModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const dialogRef = useDialogFocus(onClose);
  return <div className="modal-backdrop"><section ref={dialogRef} className="modal recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title"><LockKeyhole size={34}/><p className="eyebrow">仅显示一次</p><h2 id="recovery-title">保存你的恢复码</h2><p>换设备或清除浏览器数据后，它是找回昵称与排行榜成绩的唯一方式。</p><code>{code}</code><button className="primary-button" onClick={() => { navigator.clipboard.writeText(code); setCopied(true); }}>{copied ? "已复制" : "复制恢复码"}</button><button className="text-button centered" onClick={onClose}>我已妥善保存</button></section></div>;
}

function SettingsModal({ identity, onClose }: { identity: ReturnType<typeof useIdentity>; onClose: () => void }) {
  const [nickname, setNickname] = useState(identity.player?.nickname ?? ""); const [recovery, setRecovery] = useState(""); const [message, setMessage] = useState<string>();
  const dialogRef = useDialogFocus(onClose);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="modal settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><header><h2 id="settings-title">玩家设置</h2><button className="icon-button" onClick={onClose} aria-label="关闭"><X/></button></header>{identity.player && <p className="player-id">{identity.player.nickname} #{identity.player.shortCode}</p>}<label>昵称<input value={nickname} maxLength={12} onChange={(event) => setNickname(event.target.value)}/></label><button className="secondary-button" onClick={() => identity.rename(nickname).then(() => setMessage("昵称已更新")).catch((error: Error) => setMessage(error.message))}>保存昵称</button><hr/><label>恢复已有账号<input placeholder="输入恢复码" value={recovery} onChange={(event) => setRecovery(event.target.value)}/></label><button className="secondary-button" onClick={() => identity.recover(recovery).then(() => setMessage("账号已恢复，新恢复码即将显示")).catch((error: Error) => setMessage(error.message))}>恢复账号</button>{message && <p className="form-message" role="status">{message}</p>}</section></div>;
}

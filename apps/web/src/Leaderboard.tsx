import { useEffect, useState } from "react";
import { Award, CalendarDays, X } from "lucide-react";
import { api, type RankingRow } from "./api";
import { useDialogFocus } from "./useDialogFocus";

export function Leaderboard({ date, onClose }: { date: string; onClose: () => void }) {
  const [mode, setMode] = useState<"daily" | "season">("daily");
  const [month, setMonth] = useState(date.slice(0, 7));
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [nearby, setNearby] = useState<RankingRow[]>([]);
  const [error, setError] = useState<string>();
  const dialogRef = useDialogFocus(onClose);
  useEffect(() => {
    setError(undefined);
    const call = mode === "daily" ? api.dailyBoard(date) : api.seasonBoard(month);
    call.then((data) => { setRows(data.top); setNearby(data.nearby); }).catch((reason: Error) => setError(reason.message));
  }, [mode, date, month]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={dialogRef} className="modal leaderboard-modal" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
    <header><div><p className="eyebrow">GLOBAL RANKING</p><h2 id="leaderboard-title">世界排行</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X /></button></header>
    <div className="segmented"><button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")}><CalendarDays size={16}/>今日</button><button className={mode === "season" ? "active" : ""} onClick={() => setMode("season")}><Award size={16}/>赛季</button></div>
    {mode === "season" && <input type="month" value={month} max={date.slice(0, 7)} onChange={(event) => setMonth(event.target.value)} className="month-input" />}
    {error ? <p className="empty-state">{error}</p> : rows.length === 0 ? <p className="empty-state">还没有成绩，等你写下第一笔。</p> : <div className="ranking-list">
      {rows.map((row) => <RankRow key={row.id} row={row} season={mode === "season"} />)}
    </div>}
    {nearby.length > 0 && <><p className="list-label">我的附近</p><div className="ranking-list nearby">{nearby.map((row) => <RankRow key={row.id} row={row} season={mode === "season"} />)}</div></>}
  </section></div>;
}

function RankRow({ row, season }: { row: RankingRow; season: boolean }) {
  return <div className="rank-row"><strong className="rank-number">{row.rank}</strong><div className="rank-player"><b>{row.nickname} <small>#{row.short_code}</small></b><span>{season ? `${row.completed_days} 天参赛` : `${((row.duration_ms ?? 0) / 1000).toFixed(1)} 秒`}</span></div><div className="rank-score"><b>{season ? row.total_stars : row.stars} ★</b><span>{season ? row.total_steps : row.steps} 步</span></div></div>;
}

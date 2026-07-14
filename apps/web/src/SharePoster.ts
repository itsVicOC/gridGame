export function downloadPoster(data: { date: string; stars: number; steps: number; durationMs: number; dailyRank?: number; seasonRank?: number; streak: number }) {
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1440;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#f3ead7"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "rgba(50,60,45,.12)"; context.lineWidth = 2;
  for (let y = 120; y < 1400; y += 64) { context.beginPath(); context.moveTo(80, y); context.lineTo(1000, y); context.stroke(); }
  context.fillStyle = "#304a3e"; context.font = "700 62px serif"; context.fillText("纸径 · 每日路径拼图", 90, 145);
  context.font = "32px sans-serif"; context.fillStyle = "#7c7464"; context.fillText(data.date, 90, 205);
  context.fillStyle = "#d26a4f"; context.font = "700 150px serif"; context.fillText("★".repeat(data.stars) + "☆".repeat(3 - data.stars), 90, 450);
  context.fillStyle = "#304a3e"; context.font = "700 54px sans-serif"; context.fillText(`${data.steps} 步  ·  ${(data.durationMs / 1000).toFixed(1)} 秒`, 90, 590);
  context.font = "38px sans-serif"; context.fillStyle = "#665f52";
  context.fillText(`今日排名  #${data.dailyRank ?? "—"}`, 90, 720); context.fillText(`赛季排名  #${data.seasonRank ?? "—"}`, 90, 790); context.fillText(`连续挑战  ${data.streak} 天`, 90, 860);
  context.strokeStyle = "#304a3e"; context.lineWidth = 28; context.lineCap = "round"; context.lineJoin = "round"; context.beginPath(); context.moveTo(150, 1150); context.lineTo(340, 1000); context.lineTo(520, 1170); context.lineTo(760, 980); context.lineTo(930, 1100); context.stroke();
  context.fillStyle = "#d26a4f"; context.beginPath(); context.arc(150, 1150, 34, 0, Math.PI * 2); context.fill(); context.fillStyle = "#e3b44d"; context.beginPath(); context.arc(930, 1100, 34, 0, Math.PI * 2); context.fill();
  canvas.toBlob(async (blob) => {
    if (!blob) return; const file = new File([blob], `纸径-${data.date}.png`, { type: "image/png" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "纸径每日成绩" });
    else { const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = file.name; link.click(); URL.revokeObjectURL(link.href); }
  });
}

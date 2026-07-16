import { useRef } from "react";
import { Download, Share2 } from "lucide-react";
import { formatJapaneseCount } from "../lib/format";

type Props = {
  name: string;
  subscriberCount: number;
  deltaPct: number;
};

async function drawShareImage(canvas: HTMLCanvasElement, { name, subscriberCount, deltaPct }: Props) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = 1000;
  const H = 560;
  canvas.width = W;
  canvas.height = H;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0e14");
  bg.addColorStop(1, "#141924");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffc857";
  ctx.font = "700 32px sans-serif";
  ctx.fillText("パチログ", 48, 72);
  ctx.fillStyle = "#8b96a8";
  ctx.font = "400 18px sans-serif";
  ctx.fillText("パチンコパチスロ系YouTuber 推移トラッカー", 48, 104);

  ctx.fillStyle = "#f2f5f9";
  ctx.font = "700 44px sans-serif";
  ctx.fillText(name, 48, 220);

  ctx.font = "800 72px sans-serif";
  ctx.fillStyle = "#f2f5f9";
  ctx.fillText(formatJapaneseCount(subscriberCount, "人"), 48, 320);

  const rising = deltaPct >= 0;
  ctx.fillStyle = rising ? "#34f5a3" : "#ff5c7a";
  ctx.font = "700 40px sans-serif";
  ctx.fillText(`${rising ? "▲" : "▼"} ${Math.abs(deltaPct).toFixed(1)}%`, 48, 400);

  ctx.fillStyle = "#8b96a8";
  ctx.font = "400 18px sans-serif";
  ctx.fillText("pachilog.jp で毎日の推移をチェック", 48, 500);
}

export function ShareButton({ name, subscriberCount, deltaPct }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await drawShareImage(canvas, { name, subscriberCount, deltaPct });
    const link = document.createElement("a");
    link.download = `pachilog-${name}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleShareX = () => {
    const rising = deltaPct >= 0;
    const text = `${name} のチャンネル登録者数は現在${formatJapaneseCount(subscriberCount, "人")}！(${rising ? "▲" : "▼"}${Math.abs(deltaPct).toFixed(1)}%)\n#パチログ で推移をチェック`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex gap-2">
      <canvas ref={canvasRef} className="hidden" aria-label="シェア画像生成用キャンバス" />
      <button
        onClick={handleDownload}
        className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border py-2 text-sm font-medium hover:bg-secondary transition-colors"
      >
        <Download className="size-4" />
        画像を保存
      </button>
      <button
        onClick={handleShareX}
        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gold text-primary-foreground py-2 text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <Share2 className="size-4" />
        Xでシェア
      </button>
    </div>
  );
}

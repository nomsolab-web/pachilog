import { Link } from "wouter";
import { TrendingUp } from "lucide-react";
import type React from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 sticky top-0 z-10 backdrop-blur bg-background/80">
        <div className="max-w-[1200px] mx-auto px-4 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg shrink-0">
            <TrendingUp className="size-5 text-rise" />
            <span>
              パチ<span className="text-gold">ログ</span>
            </span>
          </Link>
          <nav className="text-sm flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 sm:gap-5 sm:overflow-visible sm:pb-0">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
              チャンネル推移
            </Link>
            <Link to="/machines" className="text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
              新台バズ
            </Link>
            <Link to="/weekly" className="text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
              週刊まとめ
            </Link>
            <Link to="/methodology" className="text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
              集計方法
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-border/60">
        <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            パチログは公開データをもとに、パチンコ・パチスロ系YouTubeチャンネルの推移を整理するサイトです。
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">
              パチログについて
            </Link>
            <Link to="/methodology" className="hover:text-foreground transition-colors">
              ランキングの集計方法
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              プライバシーポリシー
            </Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">
              お問い合わせ
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

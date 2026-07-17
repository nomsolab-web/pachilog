import { Link } from "wouter";
import { TrendingUp } from "lucide-react";
import type React from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="site-header border-b border-border/80 sticky top-0 z-10 backdrop-blur-xl">
        <div className="max-w-[1200px] mx-auto px-4 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" aria-label="パチパルス！ ホーム" className="brand-logo flex items-center gap-3 font-display font-extrabold text-xl shrink-0">
            <span className="brand-mark size-10 rounded-2xl flex items-center justify-center">
              <TrendingUp className="size-6 text-primary-foreground" strokeWidth={2.8} />
            </span>
            <span className="leading-none tracking-tight">
              <span className="text-foreground">パチ</span>
              <span className="text-gold">パルス！</span>
            </span>
          </Link>
          <nav className="text-sm flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 sm:gap-5 sm:overflow-visible sm:pb-0">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
              チャンネル推移
            </Link>
            <Link to="/channels" className="text-muted-foreground hover:text-foreground transition-colors px-1 py-1">
              全チャンネル
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
      <footer className="site-footer border-t border-border/80">
        <div className="max-w-[1200px] mx-auto px-4 py-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            パチパルス！は、動画チャンネル新台の伸びを毎日集計するデータメディアです。
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">
              パチパルス！について
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

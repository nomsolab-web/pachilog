import { Link } from "wouter";
import { TrendingUp } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 sticky top-0 z-10 backdrop-blur bg-background/80">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <TrendingUp className="size-5 text-rise" />
            <span>
              パチ<span className="text-gold">ログ</span>
            </span>
          </Link>
          <nav className="text-sm flex items-center gap-5">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              チャンネル推移
            </Link>
            <Link to="/machines" className="text-muted-foreground hover:text-foreground transition-colors">
              新台バズ
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-8">{children}</main>
      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        パチログは登録者数・再生数の推移を紹介するデータサイトです。攻略・期待値・立ち回りは扱いません。
      </footer>
    </div>
  );
}

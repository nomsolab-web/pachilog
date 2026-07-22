import { Link } from "wouter";
import { Compass, Home, Film, Flame } from "lucide-react";

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 max-w-xl mx-auto">
      <div className="relative mb-6">
        <span className="flex size-20 items-center justify-center rounded-3xl bg-gold/10 border border-gold/30 shadow-lg text-gold animate-bounce">
          <Compass className="size-10" />
        </span>
      </div>
      
      <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-foreground mb-3">
        404 Not Found
      </h1>
      
      <p className="text-muted-foreground text-sm sm:text-base leading-relaxed mb-8">
        お探しのページは移動したか、名前が変更されたか、一時的に利用できない可能性があります。URLが正しいかご確認ください。
      </p>
      
      <div className="grid gap-3 w-full sm:grid-cols-3 text-xs sm:text-sm font-semibold">
        <Link
          to="/"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background/50 hover:bg-gold/5 py-3 text-foreground transition-all hover:border-gold/50"
        >
          <Home className="size-4 text-gold" />
          トップへ
        </Link>
        <Link
          to="/videos/trending"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background/50 hover:bg-gold/5 py-3 text-foreground transition-all hover:border-gold/50"
        >
          <Film className="size-4 text-gold" />
          動画ランキング
        </Link>
        <Link
          to="/machines"
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background/50 hover:bg-gold/5 py-3 text-foreground transition-all hover:border-gold/50"
        >
          <Flame className="size-4 text-gold" />
          新台バズ
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;

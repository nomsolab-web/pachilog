import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { TrendingUp, Menu, X } from "lucide-react";
import type React from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const navItems = [
    { href: "/", label: "チャンネル推移" },
    { href: "/channels", label: "全チャンネル" },
    { href: "/machines", label: "新台バズ" },
    { href: "/weekly", label: "週刊まとめ" },
    { href: "/methodology", label: "集計方法" },
  ];

  // Close menu on Esc key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Focus trap / wrap focus when tab key is pressed
  function handleNavFocusTrap(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!menuRef.current) return;
    const focusables = menuRef.current.querySelectorAll<HTMLElement>("a, button");
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="site-header border-b border-border/80 sticky top-0 z-50 backdrop-blur-xl bg-background/80">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" aria-label="パチパルス！ ホーム" className="brand-logo flex items-center gap-2.5 font-display font-extrabold text-lg shrink-0">
            <span className="brand-mark size-8 rounded-xl flex items-center justify-center bg-gold">
              <TrendingUp className="size-5 text-black" strokeWidth={2.8} />
            </span>
            <span className="leading-none tracking-tight">
              <span className="text-foreground">パチ</span>
              <span className="text-gold">パルス！</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-semibold">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`transition-colors py-1 border-b-2 ${
                    isActive
                      ? "text-gold border-gold"
                      : "text-muted-foreground hover:text-foreground border-transparent"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Toggle Button */}
          <button
            ref={buttonRef}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "メニューを閉じる" : "メニューを開く"}
            className="md:hidden flex size-9 items-center justify-center rounded-lg border border-border/80 text-muted-foreground hover:text-foreground hover:border-border transition-all"
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {menuOpen && (
          <dialog
            id="mobile-navigation"
            ref={menuRef}
            open
            onKeyDown={handleNavFocusTrap}
            className="fixed inset-0 top-[53px] z-40 md:hidden bg-background/95 backdrop-blur-md flex flex-col p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200 border-none w-full h-[calc(100vh-53px)]"
          >
            <nav className="flex flex-col space-y-3 text-base font-semibold">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`py-2 px-3 rounded-lg border transition-all ${
                      isActive
                        ? "bg-gold/10 text-gold border-gold/30"
                        : "text-muted-foreground hover:text-foreground border-transparent"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex-1" />
            <button
              onClick={() => setMenuOpen(false)}
              className="w-full py-2.5 text-center text-xs font-semibold rounded-lg bg-secondary text-muted-foreground border border-border/40 hover:bg-secondary/80"
            >
              メニューを閉じる
            </button>
          </dialog>
        )}
      </header>
      
      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-6 sm:py-8">{children}</main>
      
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

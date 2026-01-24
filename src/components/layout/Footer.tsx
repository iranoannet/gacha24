const Footer = () => {
  return (
    <footer className="bg-footer text-footer-foreground py-8 pb-24">
      <div className="container px-4">
        <div className="grid gap-6 md:grid-cols-2">
          {/* About Section */}
          <div>
            <h3 className="text-sm font-bold mb-3">トレカガチャについて</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  利用規約
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  プライバシーポリシー
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  特定商取引法に基づく表記
                </a>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-sm font-bold mb-3">カテゴリー</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  ポケモンカードオリパ
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  ワンピースオリパ
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-primary transition-colors">
                  遊戯王オリパ
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Logo and Copyright */}
        <div className="mt-8 pt-6 border-t border-muted/20">
          <h2 className="text-lg font-black text-gradient-gold mb-2">
            トレカガチャ
          </h2>
          <p className="text-xs text-muted-foreground">
            ネットオリパ・オンラインオリパならトレカガチャ
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

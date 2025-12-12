import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, Home, MessageCircle, Phone, Lightbulb, PlayCircle, User, LogOut, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { walletApi } from "@/services/api";

const Navigation = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: "/", label: "Главная", icon: Home },
    { path: "/chat", label: "Чат", icon: MessageCircle },
    { path: "/audio", label: "Звонок", icon: Phone },
    { path: "/quotes", label: "Фразы", icon: Lightbulb },
    { path: "/meditations", label: "Медитации", icon: PlayCircle },
    { path: "/profile", label: "Профиль", icon: User },
  ];

  useEffect(() => {
    const loadWallet = async () => {
      if (!user) return;
      try {
        setWalletLoading(true);
        const data = await walletApi.getWallet(user.id);
        setWalletBalance(data.balance);
      } catch (error) {
        console.error('Failed to load wallet balance:', error);
      } finally {
        setWalletLoading(false);
      }
    };
    loadWallet();
  }, [user]);

  const goToTopUp = () => {
    navigate('/subscription');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border shadow-soft">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-full bg-hero-gradient flex items-center justify-center shadow-medium group-hover:scale-110 transition-transform">
              <span className="text-white font-bold text-sm">W</span>
            </div>
            <span className="text-xl font-bold text-foreground hidden sm:block">Windexs-Психолог</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "gap-2 transition-all hover:bg-primary/10 hover:text-black",
                      isActive && "bg-primary/10 text-primary font-semibold"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </div>

          {/* Wallet indicator */}
          {user && (
            <div className="hidden md:flex items-center gap-3 mx-4 px-3 py-1 rounded-full bg-muted/60 border border-border">
              <span className="text-sm text-muted-foreground">Кошелёк</span>
              <span className="font-semibold">{walletLoading ? '...' : walletBalance !== null ? `${walletBalance.toFixed(2)}₽` : '--'}</span>
              <Button size="sm" variant="outline" onClick={goToTopUp}>Пополнить</Button>
            </div>
          )}

          {/* User Info & Logout */}
          {user && (
            <div className="hidden md:flex items-center gap-3 ml-4 pl-4 border-l border-border">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">{user.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="gap-2 text-muted-foreground hover:text-black hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </Button>
            </div>
          )}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 animate-fade-in">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 mb-1 hover:text-black",
                      isActive && "bg-primary/10 text-primary font-semibold"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}

            {/* Mobile Logout */}
            {user && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-3 mb-3 px-2">
                  <User className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium">{user.name}</span>
                </div>
                <div className="flex items-center justify-between px-2 mb-3">
                  <div className="text-sm text-muted-foreground">Кошелёк</div>
                  <div className="font-semibold">{walletLoading ? '...' : walletBalance !== null ? `${walletBalance.toFixed(2)}₽` : '--'}</div>
                </div>
                <Button
                  variant="outline"
                  className="w-full mb-2"
                  onClick={() => {
                    setIsOpen(false);
                    goToTopUp();
                  }}
                >
                  Пополнить
                </Button>
                <Button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  variant="ghost"
                  className="w-full justify-start gap-3 text-muted-foreground hover:text-black hover:bg-destructive/10"
                >
                  <LogOut className="w-5 h-5" />
                  Выйти
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

    </nav>
  );
};

export default Navigation;

import { useEffect, useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/contexts/AuthContext";
import { walletApi } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { History, CreditCard, Wallet, Phone, MessageCircle } from "lucide-react";

interface WalletInfo {
  balance: number; // rubles
  balanceKopecks: number;
  transactions: {
    id: string;
    type: string;
    amount: number;
    amountRub?: number;
    createdAt: string;
    idempotencyKey?: string | null;
  }[];
}

const Subscription = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState(300);
  const [topupLoading, setTopupLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rates = useMemo(
    () => [
      { label: "Звонок с Марком", price: "8₽ / мин", sub: "Списывается за полные минуты", icon: Phone },
      { label: "Чат с Марком", price: "1 слово = 0.2₽", sub: "Расчёт по словам/токенам", icon: MessageCircle },
    ],
    []
  );

  const loadWallet = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await walletApi.getWallet(user.id);
      setWallet(data);
      setError(null);
    } catch (err: any) {
      console.error("Failed to load wallet:", err);
      setError("Не удалось загрузить кошелек");
    } finally {
      setLoading(false);
    }
  };

  const handleTopUp = async () => {
    if (!user) return;
    if (topupAmount <= 0) {
      setError("Введите сумму больше 0");
      return;
    }
    try {
      setTopupLoading(true);
      const data = await walletApi.topUp(user.id, topupAmount);
      setWallet((prev) => ({
        ...(prev || data),
        balance: data.balance,
        balanceKopecks: data.balanceKopecks,
        transactions: data.transaction
          ? [data.transaction, ...(prev?.transactions || [])]
          : prev?.transactions || [],
      }));
      setError(null);
    } catch (err: any) {
      console.error("Top-up failed:", err);
      setError("Не удалось пополнить кошелек");
    } finally {
      setTopupLoading(false);
    }
  };

  useEffect(() => {
    loadWallet();
  }, [user]);

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-5xl space-y-8">
          <div className="text-center space-y-3">
            <Badge className="px-3 py-1 bg-primary/10 text-primary border border-primary/20">
              Кошелёк и тарифы
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Оплата по минутам</h1>
            <p className="text-muted-foreground">
              Звонок: 8₽/мин • Чат: 2₽/мин. Пополните кошелёк и общайтесь без ограничений.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 border-2 border-border shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Баланс</h2>
                </div>
                {loading ? (
                  <span className="text-muted-foreground text-sm">Загрузка...</span>
                ) : (
                  <span className="text-2xl font-bold">{wallet ? `${wallet.balance.toFixed(2)}₽` : "--"}</span>
                )}
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(Number(e.target.value))}
                    className="flex-1"
                    placeholder="Сумма пополнения"
                  />
                  <Button onClick={handleTopUp} disabled={topupLoading || !user}>
                    {topupLoading ? "Пополняем..." : "Пополнить"}
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[100, 300, 500, 1000].map((v) => (
                    <Button key={v} variant="outline" size="sm" onClick={() => setTopupAmount(v)}>
                      +{v}₽
                    </Button>
                  ))}
                </div>
                {error && <div className="text-sm text-destructive">{error}</div>}
              </div>
            </Card>

            <Card className="p-6 border-2 border-border shadow-soft">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Тарифы (поминутно)</h2>
              </div>
              <div className="space-y-3">
                {rates.map((rate) => {
                  const Icon = rate.icon;
                  return (
                    <div key={rate.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/60">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-primary" />
                        <div>
                          <div className="font-medium">{rate.label}</div>
                          <div className="text-sm text-muted-foreground">{rate.sub}</div>
                        </div>
                      </div>
                      <div className="text-lg font-semibold whitespace-nowrap">{rate.price}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card className="p-6 border-2 border-border shadow-soft">
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">История транзакций</h2>
            </div>
            {wallet?.transactions?.length ? (
              <div className="space-y-2">
                {wallet.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {tx.type === 'topup' ? 'Пополнение' : 'Списание'}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className={tx.type === 'topup' ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                      {tx.type === 'topup' ? '+' : '-'}
                      {(tx.amountRub ?? tx.amount / 100).toFixed(2)}₽
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">Пока нет операций</div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Subscription;

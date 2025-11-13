import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Calendar, Settings, LogOut, Sparkles } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useState } from "react";

const Profile = () => {
  const [name, setName] = useState("Анна Иванова");
  const [email, setEmail] = useState("anna@example.com");
  const [joinDate] = useState("15 января 2024");

  const stats = [
    { label: "Сессий чата", value: "12", icon: "💬" },
    { label: "Аудио звонков", value: "5", icon: "📞" },
    { label: "Просмотрено фраз", value: "48", icon: "💡" },
    { label: "Медитаций", value: "23", icon: "🧘" },
  ];

  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />
      
      <div className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Личный кабинет</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">Профиль</h1>
            <p className="text-muted-foreground text-lg">
              Управляйте своим аккаунтом и отслеживайте прогресс
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <Card className="lg:col-span-1 p-6 bg-card-gradient border-2 border-border shadow-medium text-center animate-scale-in">
              <div className="w-24 h-24 mx-auto rounded-full bg-hero-gradient flex items-center justify-center shadow-strong mb-4">
                <User className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">{name}</h2>
              <p className="text-muted-foreground mb-4">{email}</p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
                <Calendar className="w-4 h-4" />
                <span>С нами с {joinDate}</span>
              </div>
              <Button variant="outline" className="w-full gap-2 hover:bg-primary/10 border-primary/30">
                <Settings className="w-4 h-4" />
                Настройки
              </Button>
            </Card>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stats */}
              <Card className="p-6 bg-card border-2 border-border shadow-soft animate-fade-in">
                <h3 className="text-xl font-bold text-foreground mb-6">Ваша активность</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stats.map((stat, index) => (
                    <div
                      key={index}
                      className="text-center p-4 rounded-xl bg-muted/50 hover:bg-primary/5 transition-colors"
                    >
                      <div className="text-3xl mb-2">{stat.icon}</div>
                      <div className="text-2xl font-bold text-primary mb-1">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Edit Profile */}
              <Card className="p-6 bg-card border-2 border-border shadow-soft animate-fade-in" style={{ animationDelay: "100ms" }}>
                <h3 className="text-xl font-bold text-foreground mb-6">Редактировать профиль</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      Имя
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <Button className="w-full bg-hero-gradient hover:opacity-90 text-white shadow-medium">
                    Сохранить изменения
                  </Button>
                </div>
              </Card>

              {/* Recent Activity */}
              <Card className="p-6 bg-card border-2 border-border shadow-soft animate-fade-in" style={{ animationDelay: "200ms" }}>
                <h3 className="text-xl font-bold text-foreground mb-4">Последняя активность</h3>
                <div className="space-y-3">
                  {[
                    { action: "Сессия чата", time: "2 часа назад", icon: "💬" },
                    { action: "Медитация: Утренняя", time: "Вчера", icon: "🧘" },
                    { action: "Аудио звонок", time: "2 дня назад", icon: "📞" },
                    { action: "Просмотр фраз", time: "3 дня назад", icon: "💡" },
                  ].map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{activity.icon}</span>
                        <span className="font-medium text-foreground">{activity.action}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Logout */}
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:bg-destructive/10 border-destructive/30 animate-fade-in"
                style={{ animationDelay: "300ms" }}
              >
                <LogOut className="w-4 h-4" />
                Выйти из аккаунта
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

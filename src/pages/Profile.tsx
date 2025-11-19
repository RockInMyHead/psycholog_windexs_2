import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Calendar, LogOut } from "lucide-react";
import Navigation from "@/components/Navigation";
import { useState, useEffect } from "react";
import { userApi } from "@/services/api";

const Profile = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Default user ID for demo purposes
  const defaultUserId = 'user@zenmindmate.com';

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);

      // Get or create user
      const userData = await userApi.getOrCreateUser(defaultUserId, 'Пользователь');
      setUser(userData);
      setName(userData.name);
      setEmail(userData.email);

    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    // Basic validation
    if (!name.trim()) {
      alert('Пожалуйста, введите имя');
      return;
    }

    if (!email.trim()) {
      alert('Пожалуйста, введите email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Пожалуйста, введите корректный email');
      return;
    }

    try {
      setLoading(true);
      await userApi.updateUser(user.id, { name: name.trim(), email: email.trim() });
      await loadUserData(); // Reload data
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Ошибка при сохранении профиля. Попробуйте еще раз.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };


  return (
    <div className="min-h-screen bg-calm-gradient">
      <Navigation />
      
      <div className="pt-24 pb-12 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-3">Профиль</h1>
            <p className="text-muted-foreground text-lg">
              Управляйте своим аккаунтом и отслеживайте прогресс
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Card */}
            <Card className="lg:col-span-1 p-6 bg-card-gradient border-2 border-border shadow-medium text-center animate-scale-in">
              <div className="w-24 h-24 mx-auto rounded-full bg-hero-gradient text-white flex items-center justify-center shadow-strong mb-4">
                <User className="w-12 h-12 " />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {loading ? "Загрузка..." : name}
              </h2>
              <p className="text-muted-foreground mb-4">
                {loading ? "Загрузка..." : email}
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
                <Calendar className="w-4 h-4" />
                <span>
                  {loading ? "Загрузка..." : `С нами с ${user ? formatDate(user.createdAt) : ''}`}
                </span>
              </div>
            </Card>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Edit Profile */}
              <Card className="p-6 bg-card border-2 border-border shadow-soft animate-fade-in" style={{ animationDelay: "100ms" }}>
                <h3 className="text-xl font-bold text-foreground mb-6">Редактировать профиль</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2">
                      <User className="w-4 h-4 text-white" />
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
                      <Mail className="w-4 h-4 text-white" />
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
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handleSaveProfile}
                      className="flex-1 bg-hero-gradient text-white hover:shadow-lg shadow-medium text-sm sm:text-base"
                      disabled={loading}
                    >
                      {loading ? "Сохранение..." : "Сохранить изменения"}
                    </Button>
                    <Button
                      onClick={() => {
                        if (user) {
                          setName(user.name);
                          setEmail(user.email);
                        }
                      }}
                      variant="outline"
                      className="px-4 sm:px-6 border-primary/30 text-primary hover:bg-primary/10 text-sm sm:text-base"
                      disabled={loading}
                    >
                      Сбросить
                    </Button>
                  </div>
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

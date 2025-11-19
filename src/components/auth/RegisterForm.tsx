import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import TermsModal from './TermsModal';

const RegisterForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      toast.error('Пожалуйста, введите имя');
      return;
    }

    if (name.trim().length < 2) {
      toast.error('Имя должно содержать минимум 2 символа');
      return;
    }

    if (!email.trim()) {
      toast.error('Пожалуйста, введите email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Пожалуйста, введите корректный email адрес');
      return;
    }

    if (!password.trim()) {
      toast.error('Пожалуйста, введите пароль');
      return;
    }

    if (password.length < 6) {
      toast.error('Пароль должен содержать минимум 6 символов');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    if (!acceptTerms) {
      toast.error('Необходимо принять пользовательское соглашение');
      return;
    }

    setLoading(true);

    try {
      const success = await register(email, password, name);
      if (success) {
        toast.success('Регистрация успешна! Добро пожаловать!');
        navigate('/');
      } else {
        toast.error('Пользователь с таким email уже существует');
      }
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Произошла ошибка при регистрации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Имя</Label>
          <Input
            id="name"
            type="text"
            placeholder="Ваше имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-email">Email</Label>
          <Input
            id="reg-email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-password">Пароль</Label>
          <Input
            id="reg-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Подтверждение пароля</Label>
          <Input
            id="confirm-password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="terms"
            checked={acceptTerms}
            onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
            Я принимаю{' '}
            <button
              type="button"
              onClick={() => setShowTerms(true)}
              className="text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded-sm"
            >
              пользовательское соглашение
            </button>
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={loading || !acceptTerms}>
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </Button>
      </form>

      <TermsModal open={showTerms} onOpenChange={setShowTerms} />
    </>
  );
};

export default RegisterForm;

import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LoginForm from '@/components/LoginForm';

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate(); const [searchParams] = useSearchParams();
  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate(searchParams.get('from') || '/', { replace: true });
  }, [isAuthenticated, isLoading, navigate, searchParams]);
  if (isLoading) return <div className="stone-login" role="status" aria-label="Chargement de la session"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (isAuthenticated) return null;
  return <LoginForm onLogin={login} />;
}

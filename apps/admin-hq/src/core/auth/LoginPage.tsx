import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { LogIn, User, Lock, Clock } from "lucide-react";
import { useAuth } from "../../core/auth/AuthContext";
import { checkLoginRateLimit } from "../../app/utils/rateLimiter";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isAuthenticated, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  useEffect(() => {
    const checkLockout = () => {
      const rateLimit = checkLoginRateLimit();
      if (!rateLimit.allowed) {
        setLockoutSeconds(rateLimit.remainingSeconds);
        setError(`Too many failed attempts. Locked out for ${rateLimit.remainingSeconds}s`);
      } else {
        if (lockoutSeconds > 0) {
           setError("");
        }
        setLockoutSeconds(0);
      }
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate("/");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setIsLoggingIn(true);
    const result = await login(email, password);
    setIsLoggingIn(false);

    if (result.success) {
      navigate("/");
    } else {
      setError(result.error || "Login failed");
      setTimeout(() => setError(""), 3000);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    const result = await loginWithGoogle();
    setIsLoggingIn(false);
    if (!result.success) {
      setError(result.error || "Google login failed");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-2 text-foreground">MessFlow</h1>
          <p className="text-muted-foreground text-lg">Admin Dashboard</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-lg border border-border">
          <h2 className="text-2xl font-bold text-center mb-8 text-foreground">Welcome Back</h2>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Email Address
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                  className="bg-input-background text-foreground pl-11 pr-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="bg-input-background text-foreground pl-11 pr-4 py-3 rounded-lg w-full border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || lockoutSeconds > 0}
              className="w-full bg-primary hover:bg-secondary text-primary-foreground rounded-xl py-4 px-6 flex items-center justify-center gap-3 transition-colors shadow-md font-semibold disabled:opacity-50"
            >
              {isLoggingIn ? <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent animate-spin rounded-full" /> : 
               lockoutSeconds > 0 ? <Clock className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
              {isLoggingIn ? "Signing In..." : 
               lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : "Sign In"}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-bold tracking-widest">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="w-full bg-[#1E2A38] hover:bg-[#253545] text-white rounded-xl py-4 px-6 flex items-center justify-center gap-3 transition-all duration-200 border border-white/10 shadow-lg disabled:opacity-50 group hover:border-[#FFD54F]/30"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="font-bold">Sign in with Google</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          High-performance mess ordering system for VIT
        </p>
      </div>
    </div>
  );
}

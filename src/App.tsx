import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, createBrowserRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import AudioCall from "./pages/AudioCall";
import Quotes from "./pages/Quotes";
import Meditations from "./pages/Meditations";
import MeditationWithMarque from "./pages/MeditationWithMarque";
import Profile from "./pages/Profile";
import Subscription from "./pages/Subscription";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-calm-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-hero-gradient flex items-center justify-center animate-pulse">
            <div className="w-8 h-8 bg-white rounded-full animate-ping"></div>
          </div>
          <p className="text-muted-foreground">Загрузка приложения...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Routes>
        <Route path="/auth" element={isAuthenticated ? <Navigate to="/" /> : <Auth />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Index />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audio"
          element={
            <ProtectedRoute>
              <AudioCall />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quotes"
          element={
            <ProtectedRoute>
              <Quotes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meditations"
          element={
            <ProtectedRoute>
              <Meditations />
            </ProtectedRoute>
          }
        />
        <Route
          path="/meditation-with-marque"
          element={
            <ProtectedRoute>
              <MeditationWithMarque />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <Subscription />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;

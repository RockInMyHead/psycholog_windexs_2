import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./utils/debug.ts";

// Check localStorage availability
if (typeof window !== 'undefined') {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    console.log('[App] localStorage is available');
    
    // Log current auth state for debugging
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      console.log('[App] Found saved user in localStorage');
    } else {
      console.log('[App] No saved user in localStorage');
    }
  } catch (e) {
    console.error('[App] localStorage is not available:', e);
  }
}

createRoot(document.getElementById("root")!).render(<App />);

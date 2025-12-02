// Debug utilities for development
// These functions can be called from browser console for debugging

export const debugAuth = {
  // Check current localStorage state
  checkStorage() {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        console.log('✅ User found in localStorage:', user);
        return user;
      } catch (e) {
        console.error('❌ Invalid user data in localStorage:', e);
        return null;
      }
    } else {
      console.log('❌ No user in localStorage');
      return null;
    }
  },

  // Clear auth data
  clearAuth() {
    localStorage.removeItem('auth_user');
    console.log('✅ Auth data cleared from localStorage');
  },

  // Set test user
  setTestUser(email: string = 'test@test.com', name: string = 'Test User') {
    const testUser = {
      id: `user_${Date.now()}`,
      email,
      name,
    };
    localStorage.setItem('auth_user', JSON.stringify(testUser));
    console.log('✅ Test user saved to localStorage:', testUser);
    console.log('⚠️  Reload page to see changes');
    return testUser;
  },

  // Show all localStorage items
  showAllStorage() {
    console.log('📦 All localStorage items:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key);
        console.log(`  ${key}:`, value);
      }
    }
  },
};

// Make debug utilities globally available in development
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as Window & { debugAuth?: typeof debugAuth }).debugAuth = debugAuth;
  console.log('🔧 Debug utilities available: window.debugAuth');
  console.log('   - debugAuth.checkStorage()');
  console.log('   - debugAuth.clearAuth()');
  console.log('   - debugAuth.setTestUser()');
  console.log('   - debugAuth.showAllStorage()');
}


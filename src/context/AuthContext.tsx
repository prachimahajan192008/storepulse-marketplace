import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { UserProfile } from '../types/storepulse';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const syncProfile = useCallback(async (user: FirebaseUser | null) => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Unable to synchronize account profile.');
      }
      const data = await res.json();
      setProfile(data.user);
      setAuthError(null);
    } catch (error) {
      console.error('Profile sync failed:', error);
      setAuthError('Signed in, but could not load account profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      void syncProfile(user);
    });
    return unsubscribe;
  }, [syncProfile]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const credential = await signInWithPopup(auth, googleAuthProvider);
      await syncProfile(credential.user);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unable to complete Google sign-in.';
      if (!message.includes('popup-closed-by-user')) {
        setAuthError('Google sign-in could not be completed. Please try again.');
      }
    }
  }, [syncProfile]);

  const logout = useCallback(async () => {
    await signOut(auth);
    setProfile(null);
  }, []);

  const getToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  const refreshProfile = useCallback(async () => {
    await syncProfile(auth.currentUser);
  }, [syncProfile]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        loading,
        authError,
        signInWithGoogle,
        logout,
        getToken,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}

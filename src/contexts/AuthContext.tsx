import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Agent } from '../../types';

interface AuthContextType {
  currentUser: User | null;
  agentProfile: Agent | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  agentProfile: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [agentProfile, setAgentProfile] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user && user.email) {
        // Intentar buscar el perfil de agente en Firestore por email
        try {
          const q = query(collection(db, 'agents'), where('email', '==', user.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            setAgentProfile({ id: doc.id, ...doc.data() } as Agent);
          } else {
            // Si no existe perfil, usar datos básicos
            setAgentProfile(null);
          }
        } catch (error) {
          console.error("Error fetching agent profile:", error);
        }
      } else {
        setAgentProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, agentProfile, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
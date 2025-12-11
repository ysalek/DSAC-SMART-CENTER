import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../src/firebase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, Phone, ArrowRight } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        // 1. Crear usuario en Authentication (Email/Pass)
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Verificar si el Admin ya pre-creó este agente en Firestore
        // Buscamos un documento en 'agents' que tenga este email
        const q = query(collection(db, 'agents'), where('email', '==', email));
        const snapshot = await getDocs(q);

        let role = 'AGENT';
        let displayName = email.split('@')[0];

        if (!snapshot.empty) {
          // ¡Existe pre-autorización!
          const oldDoc = snapshot.docs[0];
          const oldData = oldDoc.data();
          
          role = oldData.role || 'AGENT';
          displayName = oldData.displayName || displayName;

          // Si el ID del documento antiguo no coincide con el nuevo UID de Auth,
          // migramos los datos al nuevo documento (User ID) y borramos el viejo.
          // Esto es crucial para mantener la consistencia en Firestore.
          if (oldDoc.id !== user.uid) {
             await deleteDoc(doc(db, 'agents', oldDoc.id));
          }
        }

        // 3. Guardar/Actualizar el perfil definitivo con el UID correcto
        await setDoc(doc(db, 'agents', user.uid), {
          displayName: displayName,
          email: email,
          role: role, // Mantiene el rol que el Admin asignó (ej. ADMIN o SUPERVISOR)
          online: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

      } else {
        // Login normal
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Credenciales incorrectas.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado. Por favor inicia sesión.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es muy débil (mínimo 6 caracteres).');
      } else {
        setError('Error de autenticación: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-green-700 p-8 text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
             <Phone className="text-green-700" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">DSAC Smart Center</h1>
          <p className="text-green-100 text-sm mt-2">
            {isRegistering ? 'Configura tu contraseña de acceso' : 'Acceso exclusivo para operadores'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-center gap-3">
              <AlertCircle size={20} className="text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={18} className="text-gray-400" />
              </div>
              <input
                type="email"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                placeholder="operador@santacruz.gob.bo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isRegistering ? 'Crea tu Contraseña' : 'Contraseña'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={18} className="text-gray-400" />
              </div>
              <input
                type="password"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {isRegistering && <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 text-white py-3 rounded-lg font-bold hover:bg-green-800 transition shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? 'Procesando...' : (isRegistering ? 'Confirmar Registro' : 'Ingresar al Sistema')}
            {!loading && <ArrowRight size={18} />}
          </button>
          
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setError(''); setIsRegistering(!isRegistering); }}
              className="text-sm text-green-700 hover:text-green-800 font-medium hover:underline"
            >
              {isRegistering ? '¿Ya tienes contraseña? Inicia Sesión' : '¿Eres nuevo? Activa tu cuenta aquí'}
            </button>
          </div>
          
          <div className="text-center text-xs text-gray-400 mt-4 border-t pt-4">
             Gobierno Autónomo Municipal de Santa Cruz de la Sierra
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
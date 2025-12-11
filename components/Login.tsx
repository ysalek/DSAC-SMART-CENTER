import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../src/firebase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, Phone, ArrowRight, User } from 'lucide-react';

const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const ORG_DOMAIN = 'santacruz.gob.bo';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Lógica de resolución de usuario a correo
    let finalEmail = identifier.trim().toLowerCase(); // Sanitización: minúsculas y sin espacios
    const isUsername = !finalEmail.includes('@');
    
    if (isUsername) {
      finalEmail = `${finalEmail}@${ORG_DOMAIN}`;
    }

    try {
      if (isRegistering) {
        // 1. Crear usuario en Authentication
        const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
        const user = userCredential.user;

        // 2. Verificar si el Admin ya pre-creó este agente en Firestore (Migración de perfil)
        // Nota: Esto requiere que las reglas de Firestore permitan leer 'agents' al usuario recién creado.
        let role = 'AGENT';
        let displayName = identifier.split('@')[0];

        try {
          const q = query(collection(db, 'agents'), where('email', '==', finalEmail));
          const snapshot = await getDocs(q);

          if (!snapshot.empty) {
            const oldDoc = snapshot.docs[0];
            const oldData = oldDoc.data();
            
            role = oldData.role || 'AGENT';
            displayName = oldData.displayName || displayName;

            if (oldDoc.id !== user.uid) {
               // Borrar perfil temporal antiguo si existe
               await deleteDoc(doc(db, 'agents', oldDoc.id));
            }
          }
        } catch (firestoreErr) {
          console.warn("No se pudo verificar perfil pre-existente (probablemente permisos), continuando con defaults.", firestoreErr);
        }

        // 3. Guardar perfil definitivo
        await setDoc(doc(db, 'agents', user.uid), {
          displayName: displayName,
          email: finalEmail,
          role: role,
          online: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

      } else {
        // Login normal
        await signInWithEmailAndPassword(auth, finalEmail, password);
      }
      navigate('/');
    } catch (err: any) {
      console.error("Auth Error:", err);
      const errorCode = err.code;

      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password') {
        setError(
          isRegistering 
            ? 'Error en el registro. Verifica tu conexión o intenta con otro correo.' 
            : 'Credenciales incorrectas. Verifica el usuario/correo y contraseña.'
        );
      } else if (errorCode === 'auth/email-already-in-use') {
        setError('Este usuario/correo ya está registrado. Por favor inicia sesión.');
      } else if (errorCode === 'auth/weak-password') {
        setError('La contraseña es muy débil (mínimo 6 caracteres).');
      } else if (errorCode === 'auth/invalid-email') {
        setError('El formato del correo electrónico no es válido (evita espacios).');
      } else if (errorCode === 'auth/too-many-requests') {
        setError('Cuenta bloqueada temporalmente por muchos intentos. Espera unos minutos.');
      } else if (errorCode === 'auth/network-request-failed') {
        setError('Error de conexión. Verifica tu internet.');
      } else {
        setError('Error de sistema: ' + (err.message || 'Desconocido'));
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
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-center gap-3 animate-pulse">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isRegistering ? 'Correo Institucional' : 'Usuario o Correo'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isRegistering ? <Mail size={18} className="text-gray-400" /> : <User size={18} className="text-gray-400" />}
              </div>
              <input
                type={isRegistering ? "email" : "text"}
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                placeholder={isRegistering ? `nombre@${ORG_DOMAIN}` : `operador (o nombre@${ORG_DOMAIN})`}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            {!isRegistering && identifier && !identifier.includes('@') && (
               <p className="text-xs text-gray-400 mt-1 ml-1">Se ingresará como: <b>{identifier.toLowerCase().trim()}@{ORG_DOMAIN}</b></p>
            )}
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
              onClick={() => { setError(''); setIsRegistering(!isRegistering); setIdentifier(''); }}
              className="text-sm text-green-700 hover:text-green-800 font-medium hover:underline focus:outline-none"
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
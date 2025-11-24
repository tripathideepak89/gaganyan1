
import React, { useState } from 'react';
import { signInWithEmail, signUpWithEmail } from '../services/supabaseClient';

interface LoginModalProps {
  onLogin: (user: any) => void;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onClose }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
        if (isSignUp) {
            const { data, error } = await signUpWithEmail(email, password, name);
            if (error) throw error;
            if (data.user) {
                // If email confirmation is enabled in Supabase, the user might not be logged in immediately
                // but for this example we assume auto-confirm or we just notify them.
                if (data.session) {
                    onLogin(data.user);
                } else {
                    setError("Please check your email to confirm your account.");
                    setLoading(false);
                    return;
                }
            }
        } else {
            const { data, error } = await signInWithEmail(email, password);
            if (error) throw error;
            if (data.user) {
                onLogin(data.user);
            }
        }
    } catch (err: any) {
        console.error(err);
        setError(err.message || "An error occurred during authentication.");
    } finally {
        if (!error) setLoading(false); // Keep loading state if success to prevent flash before close
    }
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
        onClick={onClose}
    >
      <div 
        className="bg-gray-800 rounded-lg shadow-xl p-8 border border-gray-700 w-full max-w-md transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
            {isSignUp ? 'Create an Account' : 'Login to TravelBilli'}
        </h2>
        <p className="text-gray-400 text-center text-sm mb-6">
            {isSignUp ? 'Start planning your next adventure.' : 'Welcome back!'}
        </p>
        
        {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded-md text-sm mb-4">
                {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300">
                Full Name
                </label>
                <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full bg-gray-700 text-white placeholder-gray-400 rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200"
                placeholder="e.g., Jane Doe"
                />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full bg-gray-700 text-white placeholder-gray-400 rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200"
              placeholder="e.g., jane.doe@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1 w-full bg-gray-700 text-white placeholder-gray-400 rounded-md p-3 border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none transition duration-200"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors duration-200 text-sm"
              disabled={loading}
            >
              {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Log In')}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-400">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}
                <button 
                    onClick={() => {
                        setIsSignUp(!isSignUp);
                        setError(null);
                    }}
                    className="ml-2 text-blue-400 hover:text-blue-300 font-medium focus:outline-none"
                >
                    {isSignUp ? 'Log In' : 'Sign Up'}
                </button>
            </p>
        </div>
        
        <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>
    </div>
  );
};

export default LoginModal;

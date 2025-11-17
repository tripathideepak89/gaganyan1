import React, { useState } from 'react';

interface LoginModalProps {
  onLogin: (name: string, email: string) => void;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onLogin, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      onLogin(name, email);
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
        <h2 className="text-2xl font-bold text-white mb-6 text-center">Login to TravelBilli</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
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
          <div className="flex items-center justify-end space-x-4 pt-4">
             <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors duration-200 text-sm"
              disabled={!name.trim() || !email.trim()}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;

import React, { useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Lock } from 'lucide-react';

export const Login: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    const handleSuccess = async (credentialResponse: CredentialResponse) => {
        try {
            if (!credentialResponse.credential) {
                throw new Error("No credential received");
            }

            const response = await axios.post('/auth/google', {
                token: credentialResponse.credential
            });

            const { token, user } = response.data;
            login(token, user);
            navigate('/');
        } catch (err: any) {
            console.error("Login Failed:", err);
            if (err.response?.status === 403) {
                setError("Access Denied: You are not authorized to access this portal.");
            } else {
                setError("Login failed. Please try again.");
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-brand-dark flex items-center justify-center p-4 transition-colors">
            <div className="bg-white dark:bg-brand-card rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
                <div className="flex justify-center mb-6">
                    <div className="p-3 bg-brand-primary/10 dark:bg-brand-primary/20 rounded-full">
                        <Lock className="w-8 h-8 text-brand-primary" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Admin Portal Login</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Sign in to manage conversations and feedback.
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-4 justify-center">
                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleSuccess}
                            onError={() => setError("Google Login Failed")}
                            useOneTap
                        />
                    </div>

                    {import.meta.env.DEV && (
                        <button
                            onClick={async () => {
                                try {
                                    const response = await axios.post('/auth/dev-login');
                                    const { token, user } = response.data;
                                    login(token, user);
                                    navigate('/');
                                } catch (err) {
                                    setError("Dev Login Failed");
                                }
                            }}
                            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
                        >
                            Dev Login (Bypass)
                        </button>
                    )}
                </div>

                <p className="mt-8 text-xs text-gray-500 dark:text-gray-400">
                    Only authorized administrators and moderators can access this system.
                </p>
            </div>
        </div>
    );
};

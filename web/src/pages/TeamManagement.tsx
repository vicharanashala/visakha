import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Plus, UserPlus } from 'lucide-react';

interface Moderator {
    _id: string;
    email: string;
    role: 'moderator';
    addedBy?: string;
    createdAt: string;
}

export const TeamManagement: React.FC = () => {
    const [moderators, setModerators] = useState<Moderator[]>([]);
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchModerators();
    }, []);

    const fetchModerators = async () => {
        try {
            const response = await axios.get('/admin/moderators');
            setModerators(response.data);
            setLoading(false);
        } catch (err) {
            setError('Failed to load moderators');
            setLoading(false);
        }
    };

    const handleAddModerator = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail) return;

        try {
            await axios.post('/admin/moderators', { email: newEmail });
            setNewEmail('');
            fetchModerators();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to add moderator');
        }
    };

    const handleRemoveModerator = async (email: string) => {
        if (!confirm(`Are you sure you want to remove ${email}?`)) return;

        try {
            await axios.delete('/admin/moderators', { data: { email } });
            fetchModerators();
        } catch (err) {
            setError('Failed to remove moderator');
        }
    };

    if (loading) return <div className="p-8">Loading team data...</div>;

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <UserPlus className="w-6 h-6" />
                Team Management
            </h1>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">Add Moderator</h2>
                <form onSubmit={handleAddModerator} className="flex gap-4">
                    <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="Enter moderator email address"
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </form>
                {error && <p className="text-red-600 mt-2 text-sm">{error}</p>}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-semibold">Current Moderators</h2>
                </div>

                {moderators.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No moderators added yet.
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                                <th className="px-6 py-3">Email</th>
                                <th className="px-6 py-3">Role</th>
                                <th className="px-6 py-3">Added By</th>
                                <th className="px-6 py-3">Date Added</th>
                                <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {moderators.map((mod) => (
                                <tr key={mod._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{mod.email}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                                            Moderator
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{mod.addedBy || 'System'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(mod.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleRemoveModerator(mod.email)}
                                            className="text-red-600 hover:text-red-900 p-2 rounded-full hover:bg-red-50"
                                            title="Remove Moderator"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

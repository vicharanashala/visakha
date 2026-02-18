import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Plus,
    Pencil,
    Trash2,
    X,
    Save,
    Loader2,
    AlertCircle,
    HelpCircle
} from 'lucide-react';

interface FAQ {
    _id: string;
    question: string;
    answer: string;
}

export const FAQPage = () => {
    const { token } = useAuth();
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ question: '', answer: '' });

    const fetchFAQs = async () => {
        setLoading(true);
        setError(null);
        try {
            // Using the generic DB endpoint for faqs collection
            const response = await fetch('http://localhost:3000/admin/db/faqs', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to fetch FAQs');

            const result = await response.json();
            // result.data contains the array
            setFaqs(result.data || []);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFAQs();
    }, [token]);

    const handleEdit = (faq: FAQ) => {
        setEditingId(faq._id);
        setFormData({ question: faq.question, answer: faq.answer });
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingId(null);
        setFormData({ question: '', answer: '' });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            const url = editingId
                ? `http://localhost:3000/admin/db/faqs/${editingId}`
                : `http://localhost:3000/admin/db/faqs`;

            const method = editingId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) throw new Error('Failed to save FAQ');

            setIsModalOpen(false);
            fetchFAQs();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this FAQ?')) return;

        try {
            const response = await fetch(`http://localhost:3000/admin/db/faqs/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error('Failed to delete FAQ');

            fetchFAQs();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div className="flex h-full bg-gray-50 dark:bg-brand-dark flex-col transition-colors duration-300">
            {/* Header */}
            <header className="bg-white dark:bg-brand-card border-b border-gray-200 dark:border-gray-700 px-8 py-6 flex items-center justify-between transition-colors duration-300">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                        <HelpCircle className="w-8 h-8 mr-3 text-brand-primary" />
                        FAQ Management
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage frequently asked questions for your users</p>
                </div>
                <button
                    onClick={handleAddNew}
                    className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-teal-700 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5 mr-2" />
                    Add FAQ
                </button>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto p-8">
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center dark:bg-red-900 dark:border-red-700 dark:text-red-200">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {faqs.map((faq) => (
                            <div key={faq._id} className="bg-white dark:bg-brand-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-all hover:shadow-md dark:hover:border-gray-600">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 pr-4">
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{faq.question || 'No Question'}</h3>
                                        <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{faq.answer || 'No Answer'}</p>
                                    </div>
                                    <div className="flex space-x-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleEdit(faq)}
                                            className="text-gray-400 hover:text-brand-primary dark:hover:text-brand-primary p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-full transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(faq._id)}
                                            className="text-gray-400 hover:text-red-600 p-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-full transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {faqs.length === 0 && !loading && (
                            <div className="text-center py-12 bg-white dark:bg-brand-card rounded-lg border border-dashed border-gray-300 dark:border-gray-700 transition-colors duration-300">
                                <HelpCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400 text-lg">No FAQs found.</p>
                                <button
                                    onClick={handleAddNew}
                                    className="mt-2 text-brand-primary hover:text-teal-700 font-medium"
                                >
                                    Create your first FAQ
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-brand-card rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] transition-colors duration-300">
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                {editingId ? 'Edit FAQ' : 'Add New FAQ'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Question</label>
                                <input
                                    type="text"
                                    value={formData.question}
                                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-brand-surface border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-gray-900 dark:text-gray-100 transition-all placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="e.g., How do I reset my password?"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Answer</label>
                                <textarea
                                    value={formData.answer}
                                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                                    className="w-full px-4 py-2 bg-white dark:bg-brand-surface border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-gray-900 dark:text-gray-100 h-40 resize-y transition-all placeholder-gray-400 dark:placeholder-gray-500"
                                    placeholder="Enter the answer here..."
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3 bg-gray-50 dark:bg-brand-surface rounded-b-xl transition-colors duration-300">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-brand-card hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!formData.question || !formData.answer}
                                className="px-5 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-teal-700 flex items-center font-medium shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Save FAQ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Database,
    Table,
    Plus,
    Pencil,
    Trash2,
    X,
    Save,
    Loader2,
    AlertCircle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

const COLLECTIONS = ['users', 'conversations', 'messages', 'faqs'];

export const DatabaseManagement = () => {
    const { token } = useAuth();
    const [selectedCollection, setSelectedCollection] = useState<string>('users');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const limit = 20;

    // Editing state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [jsonInput, setJsonInput] = useState('');
    const [jsonError, setJsonError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:3000/admin/db/${selectedCollection}?page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('Fetch error response:', text);
                throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
            }

            const clone = response.clone();
            try {
                const result = await response.json();
                setData(result.data);
                setTotalPages(result.totalPages);
            } catch (e) {
                const text = await clone.text();
                throw new Error('Invalid JSON response from server. Content: ' + text.slice(0, 100));
            }
        } catch (err) {
            console.error('Fetch error:', err);
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedCollection, page, token]);

    const handleEdit = (item: any) => {
        setEditingItem(item);
        setJsonInput(JSON.stringify(item, null, 2));
        setJsonError(null);
        setIsModalOpen(true);
    };

    const handleAddNew = () => {
        setEditingItem(null);
        if (selectedCollection === 'faqs') {
            setJsonInput('{\n  "question": "",\n  "answer": ""\n}');
        } else {
            setJsonInput('{\n  \n}');
        }
        setJsonError(null);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        try {
            let parsedData;
            try {
                parsedData = JSON.parse(jsonInput);
            } catch (e) {
                setJsonError("Invalid JSON format");
                return;
            }

            const url = editingItem
                ? `http://localhost:3000/admin/db/${selectedCollection}/${editingItem._id}`
                : `http://localhost:3000/admin/db/${selectedCollection}`;

            const method = editingItem ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(parsedData)
            });

            if (!response.ok) {
                throw new Error('Failed to save data');
            }

            setIsModalOpen(false);
            fetchData();
        } catch (err) {
            setJsonError((err as Error).message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;

        try {
            const response = await fetch(`http://localhost:3000/admin/db/${selectedCollection}/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to delete document: ${errorText}`);
            }

            fetchData();
        } catch (err) {
            setError((err as Error).message);
        }
    };

    // Helper function to render cell content
    const renderCell = (value: any) => {
        if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
        }
        return String(value);
    };

    return (
        <div className="flex h-full bg-gray-50 dark:bg-brand-dark flex-col transition-colors duration-300">
            {/* Header */}
            <header className="bg-white dark:bg-brand-card border-b border-gray-200 dark:border-gray-700 px-8 py-6 flex items-center justify-between transition-colors duration-300">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center">
                        <Database className="w-8 h-8 mr-3 text-brand-primary" />
                        Database Management
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your application data directly</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="relative">
                        <select
                            value={selectedCollection}
                            onChange={(e) => {
                                setSelectedCollection(e.target.value);
                                setPage(1);
                            }}
                            className="appearance-none bg-white dark:bg-brand-surface border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 py-2 pl-4 pr-10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent cursor-pointer shadow-sm transition-colors"
                        >
                            {COLLECTIONS.map(c => (
                                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 dark:text-gray-400">
                            <ChevronDown className="h-4 w-4" />
                        </div>
                    </div>

                    <button
                        onClick={handleAddNew}
                        className="flex items-center px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-teal-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Add New
                    </button>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto p-8">
                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center dark:bg-red-900 dark:border-red-700 dark:text-red-200">
                        <AlertCircle className="w-5 h-5 mr-2" />
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                    </div>
                ) : (
                    <div className="bg-white dark:bg-brand-card rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-300">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-brand-surface">
                                    <tr>
                                        {/* Headers */}
                                        {data.length > 0 && Object.keys(data[0]).slice(0, 5).map((key) => (
                                            <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                {key}
                                            </th>
                                        ))}
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-brand-card divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
                                    {data.map((item: any) => (
                                        <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            {Object.keys(item).slice(0, 5).map((key) => (
                                                <td key={key} className="px-6 py-4 whitespace-nowrap text-sm">
                                                    {renderCell(item[key])}
                                                </td>
                                            ))}
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => handleEdit(item)} className="text-brand-primary hover:text-teal-700 mr-4 transition-colors">Edit</button>
                                                <button onClick={() => handleDelete(item._id)} className="text-red-600 hover:text-red-800 transition-colors">Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No documents found in this collection.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="bg-white dark:bg-brand-card px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between sm:px-6 transition-colors duration-300">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-brand-surface hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-brand-surface hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700 dark:text-gray-400">
                                        Showing page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span>
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-brand-surface text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                                        >
                                            <span className="sr-only">Previous</span>
                                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-brand-surface text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                                        >
                                            <span className="sr-only">Next</span>
                                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-brand-card rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] transition-colors duration-300">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                                {editingItem ? 'Edit Document' : 'Add New Document'}
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 flex-1 overflow-y-auto">
                            {jsonError && (
                                <div className="mb-4 bg-red-50 text-red-700 px-4 py-2 rounded text-sm dark:bg-red-900 dark:text-red-200">
                                    {jsonError}
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    JSON Data
                                </label>
                                <div className="relative">
                                    <textarea
                                        value={jsonInput}
                                        onChange={(e) => setJsonInput(e.target.value)}
                                        className="w-full h-96 font-mono text-sm bg-gray-50 dark:bg-brand-surface border border-gray-300 dark:border-gray-600 rounded-lg p-4 focus:ring-2 focus:ring-brand-primary focus:border-transparent text-gray-900 dark:text-gray-100 resize-none transition-colors"
                                        placeholder="{ ... }"
                                        spellCheck="false"
                                    />
                                </div>
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Enter valid JSON object. Fields like _id, createdAt, updatedAt are handled automatically.
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3 bg-gray-50 dark:bg-brand-surface rounded-b-xl transition-colors duration-300">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-brand-card hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-5 py-2.5 bg-brand-primary text-white rounded-lg hover:bg-teal-700 flex items-center font-medium shadow-sm transition-colors"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

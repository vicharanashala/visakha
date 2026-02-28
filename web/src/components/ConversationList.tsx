import type { Conversation } from '../types';
import { format } from 'date-fns';
import { MessageSquare, CheckCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import clsx from 'clsx';
import { Link, useParams } from 'react-router-dom';

interface ConversationListProps {
    conversations: Conversation[];
    loading: boolean;
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export function ConversationList({
    conversations,
    loading,
    page,
    totalPages,
    onPageChange
}: ConversationListProps) {
    const { id: selectedId } = useParams();

    if (loading && conversations.length === 0) {
        return (
            <div className="w-80 border-r border-gray-200 bg-white h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-brand-card h-full flex flex-col transition-colors duration-300">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="font-semibold text-gray-800 dark:text-gray-200">Inbox</h2>
            </div>

            <div className="flex-1 overflow-y-auto">
                {conversations.map((conv) => (
                    <Link
                        key={conv.conversationId}
                        to={`/c/${conv.conversationId}`}
                        className={clsx(
                            "block p-4 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-brand-surface transition-colors",
                            selectedId === conv.conversationId ? "bg-brand-primary/10 dark:bg-brand-primary/20" : ""
                        )}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <h3 className={clsx(
                                "font-medium text-sm truncate pr-2",
                                selectedId === conv.conversationId ? "text-brand-primary dark:text-brand-primary" : "text-gray-900 dark:text-gray-100"
                            )}>
                                {conv.title || "Untitled Conversation"}
                            </h3>
                            {conv.resolved && (
                                <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                            )}
                        </div>

                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                            <span className="flex items-center gap-1">
                                <MessageSquare size={12} />
                                {conv.messages.length}
                            </span>
                            <span>
                                {format(new Date(conv.latestFeedbackDate || conv.updatedAt), 'MMM d, h:mm a')}
                            </span>
                        </div>

                        {/* Preview latest feedback */}
                        {(() => {
                            const lastFeedbackMsg = [...conv.messages].reverse().find(m => m.feedback);
                            if (lastFeedbackMsg?.feedback) {
                                const isPositive = lastFeedbackMsg.feedback.rating === 'thumbsUp';
                                return (
                                    <div className={clsx(
                                        "mt-2 text-xs px-2 py-1 rounded inline-flex items-center gap-1",
                                        isPositive
                                            ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                            : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                    )}>
                                        {isPositive ? <ThumbsUp size={10} /> : <ThumbsDown size={10} />}
                                        <span className="truncate max-w-[150px]">
                                            {lastFeedbackMsg.feedback.tag || (isPositive ? 'Positive' : 'Negative')}
                                        </span>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                    </Link>
                ))}
            </div>

            {/* Pagination */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-brand-card">
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={page === 1 || loading}
                    className="px-2 py-1 text-sm disabled:opacity-50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                    Previous
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    Page {page} of {totalPages}
                </span>
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={page === totalPages || loading}
                    className="px-2 py-1 text-sm disabled:opacity-50 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                    Next
                </button>
            </div>
        </div>
    );
}

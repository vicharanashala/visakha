import { useState, useEffect } from 'react';
import { MessageBubble } from './MessageBubble';
import type { Conversation, Message } from '../types';
import { CheckCircle, Circle, Clock, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';

interface ConversationDetailProps {
    conversationId: string;
}

export function ConversationDetail({ conversationId }: ConversationDetailProps) {
    const [conversation, setConversation] = useState<Conversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConversation = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/feedback-conversations/${conversationId}`);
                if (!res.ok) throw new Error('Failed to fetch conversation');
                const data = await res.json();
                setConversation(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Error loading conversation');
            } finally {
                setLoading(false);
            }
        };

        if (conversationId) {
            fetchConversation();
        }
    }, [conversationId]);

    const toggleResolved = async () => {
        if (!conversation) return;
        const newStatus = !conversation.resolved;

        // Optimistic update
        setConversation(prev => prev ? { ...prev, resolved: newStatus } : null);

        try {
            const res = await fetch(`/feedback-conversations/${conversation.conversationId}/resolved`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolved: newStatus })
            });
            if (!res.ok) throw new Error('Failed to update status');
        } catch (err) {
            // Revert on error
            console.error(err);
            setConversation(prev => prev ? { ...prev, resolved: !newStatus } : null);
            alert('Failed to update resolution status');
        }
    };

    if (loading) {
        return (
            <div className="flex-1 h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !conversation) {
        return (
            <div className="flex-1 h-full flex items-center justify-center text-red-500">
                <p>{error || 'Conversation not found'}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 mb-1">
                        {conversation.title || 'Untitled Conversation'}
                    </h1>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {format(new Date(conversation.createdAt), 'MMM d, yyyy h:mm a')}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageSquare size={12} />
                            {conversation.messages.length} messages
                        </span>
                        <span className="font-mono text-gray-400">ID: {conversation.conversationId}</span>
                    </div>
                </div>

                <button
                    onClick={toggleResolved}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
                        conversation.resolved
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    )}
                >
                    {conversation.resolved ? (
                        <>
                            <CheckCircle size={16} />
                            Resolved
                        </>
                    ) : (
                        <>
                            <Circle size={16} />
                            Mark Resolved
                        </>
                    )}
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-white">
                {conversation.messages.map((msg: Message) => (
                    <MessageBubble key={msg.messageId} message={msg} />
                ))}
                <div className="h-10"></div> {/* Spacer */}
            </div>
        </div>
    );
}

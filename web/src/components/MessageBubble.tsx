import { useState } from 'react';
import type { Message, ContentBlock } from '../types';
import { format } from 'date-fns';
import { User, Bot, ChevronDown, ChevronRight, Terminal, Brain, ThumbsUp, ThumbsDown } from 'lucide-react';
import clsx from 'clsx';

interface MessageBubbleProps {
    message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.sender === 'User';

    return (
        <div className={clsx(
            "flex gap-4 p-6 border-b border-gray-100",
            isUser ? "bg-white" : "bg-gray-50/50"
        )}>
            <div className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                isUser ? "bg-gray-200 text-gray-600" : "bg-blue-600 text-white"
            )}>
                {isUser ? <User size={16} /> : <Bot size={16} />}
            </div>

            <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-gray-900">
                        {isUser ? (message.user?.name || "User") : (message.model || "Model")}
                    </span>
                    <span className="text-xs text-gray-400">
                        {format(new Date(message.createdAt), 'h:mm a')}
                    </span>
                </div>

                <div className="text-sm text-gray-800 leading-relaxed space-y-2">
                    {message.text && <p className="whitespace-pre-wrap">{message.text}</p>}

                    {message.content && (
                        typeof message.content === 'string'
                            ? <p className="whitespace-pre-wrap">{message.content}</p>
                            : <div className="space-y-4">
                                {(message.content as ContentBlock[]).map((block, idx) => (
                                    <ContentBlockRenderer key={idx} block={block} />
                                ))}
                            </div>
                    )}
                </div>

                {message.feedback && (
                    <div className={clsx(
                        "mt-4 p-3 rounded-lg border text-sm inline-block",
                        message.feedback.rating === 'thumbsUp'
                            ? "bg-green-50 border-green-200 text-green-800"
                            : "bg-red-50 border-red-200 text-red-800"
                    )}>
                        <div className="flex items-center gap-2 font-medium">
                            {message.feedback.rating === 'thumbsUp' ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
                            <span>{message.feedback.tag || (message.feedback.rating === 'thumbsUp' ? 'Positive' : 'Negative')}</span>
                        </div>
                        {message.feedback.text && (
                            <p className="mt-1 text-xs opacity-90 border-t border-black/10 pt-2">
                                "{message.feedback.text}"
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function ContentBlockRenderer({ block }: { block: ContentBlock }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (block.type === 'text') {
        return <p className="whitespace-pre-wrap">{block.text}</p>;
    }

    if (block.type === 'think') {
        return (
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium text-gray-600"
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Brain size={14} className="text-purple-500" />
                    <span>Thinking Process</span>
                </button>

                {isExpanded && (
                    <div className="p-3 bg-gray-50/50 text-gray-600 font-mono text-xs whitespace-pre-wrap border-t border-gray-200">
                        {block.think}
                    </div>
                )}
            </div>
        );
    }

    if (block.type === 'tool_call') {
        return (
            <div className="rounded-lg border border-gray-200 overflow-hidden bg-white my-2">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium text-gray-700"
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Terminal size={14} className="text-gray-500" />
                    <span className="font-mono">{block.tool_call?.name || 'Tool Call'}</span>
                </button>

                {isExpanded && (
                    <div className="p-3 bg-gray-900 text-green-400 font-mono text-xs overflow-x-auto">
                        <pre>{JSON.stringify(block.tool_call?.args, null, 2)}</pre>
                    </div>
                )}
            </div>
        );
    }

    return null;
}

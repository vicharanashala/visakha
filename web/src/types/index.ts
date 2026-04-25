export interface Feedback {
    rating: 'thumbsUp' | 'thumbsDown';
    tag?: string;
    text?: string;
}

export interface User {
    _id: string;
    name?: string;
    username?: string;
    email?: string;
}

export interface Message {
    messageId: string;
    sender: 'User' | 'Model';
    createdAt: string;
    updatedAt?: string;
    model?: string;
    feedback?: Feedback;
    text?: string; // For User messages
    content?: string | ContentBlock[]; // For Model messages
    user?: User;
}

export interface ContentBlock {
    type: 'text' | 'think' | 'tool_call';
    text?: string;
    think?: string;
    tool_call?: {
        name: string;
        args: any;
    };
}

export interface Conversation {
    _id: string;
    conversationId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    latestFeedbackDate?: string;
    resolved?: boolean;
    messages: Message[];
}

export interface PaginatedResponse<T> {
    page: number;
    limit: number;
    count: number;
    total: number;
    totalPages: number;
    data: T[];
}

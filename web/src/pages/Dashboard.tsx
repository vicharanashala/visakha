import { useParams } from 'react-router-dom';
import { useConversations } from '../hooks/useConversations';
import { ConversationList } from '../components/ConversationList';
import { ConversationDetail } from '../components/ConversationDetail';

export function Dashboard() {
    const { id } = useParams();
    const { conversations, loading, page, totalPages, setPage } = useConversations();

    return (
        <div className="flex h-full w-full">
            <ConversationList
                conversations={conversations}
                loading={loading}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
            />

            <div className="flex-1 h-full bg-white overflow-hidden relative flex flex-col">
                {id ? (
                    <ConversationDetail conversationId={id} />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50">
                        <div className="text-center">
                            <p className="mb-2">Select a conversation to view details</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

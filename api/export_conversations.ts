import fs from 'fs';
import path from 'path';

// API Configuration
const API_URL = 'http://localhost:3000/feedback-conversations';
const OUTPUT_FILE = path.join(process.cwd(), 'all_conversations.md');

async function fetchAllConversations() {
    try {
        console.log('Fetching conversations...');
        // Fetch with a high limit to get all (or implement pagination if strict)
        // Assuming 1000 is enough for now based on typical dev data
        const response = await fetch(`${API_URL}?limit=1000`);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const json = await response.json();
        const conversations = json.data;

        console.log(`Retrieved ${conversations.length} conversations.`);
        return conversations;
    } catch (error) {
        console.error('Failed to fetch data:', error);
        process.exit(1);
    }
}

function formatConversation(conv) {
    let md = `## ${conv.title || 'Untitled Conversation'}\n\n`;
    md += `**ID:** ${conv.conversationId}\n`;
    md += `**Date:** ${new Date(conv.createdAt).toLocaleString()}\n`;
    md += `**Status:** ${conv.resolved ? 'Resolved' : 'Open'}\n`;
    md += `\n---\n\n`;

    if (conv.messages && conv.messages.length > 0) {
        conv.messages.forEach(msg => {
            const sender = msg.sender === 'User' ? '👤 **User**' : '🤖 **Model**';
            const timestamp = new Date(msg.createdAt).toLocaleTimeString();

            md += `${sender} (${timestamp})\n\n`;

            if (msg.text) {
                md += `${msg.text}\n\n`;
            }

            if (msg.content) {
                // Simplify content block handling if complex, otherwise just dump it
                if (typeof msg.content === 'string') {
                    md += `${msg.content}\n\n`;
                } else if (Array.isArray(msg.content)) {
                    msg.content.forEach(block => {
                        if (block.type === 'text') md += `${block.text}\n`;
                        if (block.type === 'think') md += `> *Thinking:*\n> ${block.think}\n`;
                        // Add more block types if needed
                    });
                    md += `\n`;
                }
            }

            if (msg.feedback) {
                md += `> **Feedback:** ${msg.feedback.rating} ${msg.feedback.text ? '- ' + msg.feedback.text : ''}\n\n`;
            }
        });
    } else {
        md += `*No messages in this conversation.*\n\n`;
    }

    md += `\n---\n\n`;
    return md;
}

async function main() {
    const conversations = await fetchAllConversations();

    let markdownContent = `# All Conversations Export\n\n`;
    markdownContent += `Generated on: ${new Date().toLocaleString()}\n`;
    markdownContent += `Total Conversations: ${conversations.length}\n\n`;
    markdownContent += `---\n\n`;

    conversations.forEach(conv => {
        markdownContent += formatConversation(conv);
    });

    // Write using artifact path logic if needed, but for now retrieving to local root
    // The system will guide where to place it. I'll place it in the artifacts dir provided in environment or just current cwd.
    // The user requested "Get... as a document".
    // I will write it to the absolute path provided in the prompt's artifact directory.

    const artifactDir = 'C:\\Users\\Nitin\\.gemini\\antigravity\\brain\\57a70c48-c0a1-4d2b-8967-7216f9e64412';
    const finalPath = path.join(artifactDir, 'all_conversations.md');

    fs.writeFileSync(finalPath, markdownContent);
    console.log(`Successfully exported to: ${finalPath}`);
}

main();

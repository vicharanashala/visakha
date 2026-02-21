#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/visakha";
const DB_NAME = "visakha";
const COLLECTION_NAME = "rag_knowledge";

// Define the tool
const SEARCH_TOOL: Tool = {
    name: "search_golden_knowledge",
    description: "Search the Golden Knowledge Base for verified answers to user questions. textual search.",
    inputSchema: {
        type: "object",
        properties: {
            query: {
                type: "string",
                description: "The search query to find relevant knowledge",
            },
            limit: {
                type: "number",
                description: "Max number of results to return (default: 3)",
            },
        },
        required: ["query"],
    },
};

// Server implementation
class VisakhaKnowledgeServer {
    private server: Server;
    private client: MongoClient | null = null;

    constructor() {
        this.server = new Server(
            {
                name: "visakha-knowledge-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupHandlers();
        this.setupErrorHandling();
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [SEARCH_TOOL],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name !== "search_golden_knowledge") {
                throw new Error(`Unknown tool: ${request.params.name}`);
            }

            const args = request.params.arguments as { query: string; limit?: number };
            const limit = args.limit || 3;

            try {
                const results = await this.searchKnowledge(args.query, limit);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(results, null, 2),
                        },
                    ],
                };
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error searching knowledge base: ${(error as Error).message}`,
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    private async searchKnowledge(query: string, limit: number) {
        if (!this.client) {
            // Lazy connection
            this.client = new MongoClient(MONGO_URI);
            await this.client.connect();
        }

        const db = this.client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        // Use text search if index exists, else partial regex match (not ideal for perf but works for MVP)
        // Ideally we ensure a text index exists.

        // For this implementation, let's try a regex search on question and answer
        // OR a $text search if setup. 
        // Let's assume partial match for robust start without setup scripts.
        const regex = new RegExp(query, 'i');

        const results = await collection.find({
            $or: [
                { question: regex },
                { answer: regex },
                { tags: regex }
            ]
        })
            .limit(limit)
            .project({ _id: 0, sourceMessageId: 0, createdBy: 0, createdAt: 0, updatedAt: 0 }) // Clean output
            .toArray();

        return results;
    }

    private setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error("[MCP Error]", error);
        };

        process.on("SIGINT", async () => {
            if (this.client) await this.client.close();
            await this.server.close();
            process.exit(0);
        });
    }

    public async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Visakha Knowledge MCP Server running on stdio");
    }
}

const server = new VisakhaKnowledgeServer();
server.run().catch(console.error);

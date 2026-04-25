import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { MongoClient, Db, ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "test";

if (!MONGO_URI) {
    throw new Error("MONGO_URI environment variable is required");
}

let db: Db | null = null;
const client = new MongoClient(MONGO_URI);

async function connectDB() {
    if (!db) {
        await client.connect();
        db = client.db(DB_NAME);
        console.error("Successfully connected to MongoDB");
    }
    return db;
}

const server = new Server(
    {
        name: "visakha-rag-server",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * List available tools.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "search_rag",
                description: "Search the RAG knowledge base for answers to user questions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The search query or question.",
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of results to return (default: 5).",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "get_knowledge",
                description: "Retrieve a specific knowledge entry by its ID.",
                inputSchema: {
                    type: "object",
                    properties: {
                        id: {
                            type: "string",
                            description: "The MongoDB ObjectId of the knowledge entry.",
                        },
                    },
                    required: ["id"],
                },
            },
        ],
    };
});

/**
 * Handle tool calls.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const database = await connectDB();
    const { name, arguments: args } = request.params;

    try {
        if (name === "search_rag") {
            const query = String(args?.query);
            const limit = Number(args?.limit) || 5;

            const results = await database
                .collection("rag_knowledge")
                .find({
                    $text: { $search: query },
                })
                .sort({ score: { $meta: "textScore" } })
                .limit(limit)
                .toArray();

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(results, null, 2),
                    },
                ],
            };
        } else if (name === "get_knowledge") {
            const id = String(args?.id);

            const result = await database
                .collection("rag_knowledge")
                .findOne({ _id: new ObjectId(id) });

            if (!result) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `No knowledge entry found with ID: ${id}`,
                        },
                    ],
                    isError: true,
                };
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2),
                    },
                ],
            };
        } else {
            throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error: any) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`,
                },
            ],
            isError: true,
        };
    }
});

/**
 * Start the server using stdio transport.
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Visakha RAG MCP server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});

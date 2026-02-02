import express, {type Request, type Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "./db.js";
import { ObjectId } from "mongodb";

const app: express.Application = express();
app.use(express.json());

app.get("/feedback-conversations", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [
      // 1. Match messages with feedback
      {
        $match: {
          feedback: { $exists: true }
        }
      },

      // 2. Group by conversationId to get unique conversations
      {
        $group: {
          _id: "$conversationId",
          latestFeedbackDate: { $max: "$updatedAt" }
        }
      },

      // 3. Lookup the conversation details
      {
        $lookup: {
          from: "conversations",
          localField: "_id",
          foreignField: "conversationId",
          as: "conversation"
        }
      },
      { $unwind: "$conversation" },

      // 4. Lookup all messages for this conversation
      {
        $lookup: {
          from: "messages",
          let: { messageIds: "$conversation.messages" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$messageIds"]
                }
              }
            },
            { $sort: { createdAt: 1 } } // Sort messages chronologically
          ],
          as: "messagesData"
        }
      },

      // 5. Lookup user data for User messages
      {
        $lookup: {
          from: "users",
          let: {
            userIds: {
              $map: {
                input: {
                  $filter: {
                    input: "$messagesData",
                    as: "msg",
                    cond: { $eq: ["$$msg.sender", "User"] }
                  }
                },
                as: "msg",
                in: "$$msg.user"
              }
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    "$$userIds"
                  ]
                }
              }
            }
          ],
          as: "usersData"
        }
      },

      // 6. Project the final structure
      {
        $project: {
          _id: "$conversation._id",
          conversationId: "$conversation.conversationId",
          title: "$conversation.title",
          createdAt: "$conversation.createdAt",
          updatedAt: "$conversation.updatedAt",
          latestFeedbackDate: 1,
          resolved: "$conversation.resolved",

          messages: {
            $map: {
              input: "$messagesData",
              as: "msg",
              in: {
                messageId: "$$msg._id",
                sender: "$$msg.sender",
                createdAt: "$$msg.createdAt",
                updatedAt: "$$msg.updatedAt",
                model: "$$msg.model",
                feedback: "$$msg.feedback",

                // Body/content based on sender
                text: {
                  $cond: [
                    { $eq: ["$$msg.sender", "User"] },
                    "$$msg.text",
                    null
                  ]
                },

                content: {
                  $cond: [
                    { $ne: ["$$msg.sender", "User"] },
                    "$$msg.content",
                    null
                  ]
                },

                // User details (only for User messages)
                user: {
                  $cond: [
                    { $eq: ["$$msg.sender", "User"] },
                    {
                      $let: {
                        vars: {
                          matchedUser: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$usersData",
                                  as: "u",
                                  cond: {
                                    $eq: [
                                      { $toString: "$$u._id" },
                                      "$$msg.user"
                                    ]
                                  }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          _id: "$$matchedUser._id",
                          name: "$$matchedUser.name",
                          username: "$$matchedUser.username",
                          email: "$$matchedUser.email"
                        }
                      }
                    },
                    null
                  ]
                }
              }
            }
          }
        }
      },

      // 7. Sort by latest feedback date
      { $sort: { latestFeedbackDate: -1 } },

      // 8. Pagination
      { $skip: skip },
      { $limit: limit }
    ];

    const result = await db
      .collection("messages")
      .aggregate(pipeline)
      .toArray();

    // Get total count for pagination
    const countPipeline = [
      { $match: { feedback: { $exists: true } } },
      { $group: { _id: "$conversationId" } },
      { $count: "total" }
    ];

    const countResult = await db
      .collection("messages")
      .aggregate(countPipeline)
      .toArray();

    const totalCount = countResult.length > 0 ? countResult[0]!.total : 0;

    res.json({
      page,
      limit,
      count: result.length,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit),
      data: result
    });
  } catch (err) {
    console.error(err);
    const error = err as Error;
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

// Additional endpoint to get a single feedback conversation by ID
app.get("/feedback-conversations/:conversationId", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const { conversationId } = req.params;

    const pipeline = [
      {
        $match: {
          conversationId: conversationId,
          feedback: { $exists: true }
        }
      },
      {
        $lookup: {
          from: "conversations",
          localField: "conversationId",
          foreignField: "conversationId",
          as: "conversation"
        }
      },
      { $unwind: "$conversation" },
      {
        $lookup: {
          from: "messages",
          let: { messageIds: "$conversation.messages" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", "$$messageIds"] }
              }
            },
            { $sort: { createdAt: 1 } }
          ],
          as: "messagesData"
        }
      },
      {
        $lookup: {
          from: "users",
          let: {
            userIds: {
              $map: {
                input: {
                  $filter: {
                    input: "$messagesData",
                    as: "msg",
                    cond: { $eq: ["$$msg.sender", "User"] }
                  }
                },
                as: "msg",
                in: "$$msg.user"
              }
            }
          },
          pipeline: [
            {
              $match: {
                $expr: { $in: [{ $toString: "$_id" }, "$$userIds"] }
              }
            }
          ],
          as: "usersData"
        }
      },
      {
        $project: {
          _id: "$conversation._id",
          conversationId: "$conversation.conversationId",
          title: "$conversation.title",
          createdAt: "$conversation.createdAt",
          updatedAt: "$conversation.updatedAt",
          resolved: "$conversation.resolved",

          messages: {
            $map: {
              input: "$messagesData",
              as: "msg",
              in: {
                messageId: "$$msg._id",
                sender: "$$msg.sender",
                createdAt: "$$msg.createdAt",
                model: "$$msg.model",
                feedback: "$$msg.feedback",
                text: {
                  $cond: [
                    { $eq: ["$$msg.sender", "User"] },
                    "$$msg.text",
                    null
                  ]
                },
                content: {
                  $cond: [
                    { $ne: ["$$msg.sender", "User"] },
                    "$$msg.content",
                    null
                  ]
                },
                user: {
                  $cond: [
                    { $eq: ["$$msg.sender", "User"] },
                    {
                      $let: {
                        vars: {
                          matchedUser: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$usersData",
                                  as: "u",
                                  cond: {
                                    $eq: [
                                      { $toString: "$$u._id" },
                                      "$$msg.user"
                                    ]
                                  }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          _id: "$$matchedUser._id",
                          name: "$$matchedUser.name",
                          username: "$$matchedUser.username",
                          email: "$$matchedUser.email"
                        }
                      }
                    },
                    null
                  ]
                }
              }
            }
          }
        }
      },
      { $limit: 1 }
    ];

    const result = await db
      .collection("messages")
      .aggregate(pipeline)
      .toArray();

    if (result.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json(result[0]);
  } catch (err) {
    console.error(err);
    const error = err as Error;
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

// New endpoint to toggle resolved status
app.patch("/feedback-conversations/:conversationId/resolved", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();
    const { conversationId } = req.params;
    const { resolved } = req.body;

    if (typeof resolved !== 'boolean') {
      return res.status(400).json({ error: "Invalid request", message: "resolved must be a boolean" });
    }

    const result = await db
      .collection("conversations")
      .updateOne(
        { conversationId: conversationId },
        { $set: { resolved: resolved } }
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({
      success: true,
      conversationId,
      resolved
    });
  } catch (err) {
    console.error(err);
    const error = err as Error;
    res.status(500).json({ error: "Internal Server Error", message: error.message });
  }
});

// Endpoint to serve the HTML viewer with data loaded
app.get("/", async (req: Request, res: Response) => {
  try {
    const db = await connectDB();

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 5;
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $match: {
          feedback: { $exists: true }
        }
      },
      {
        $group: {
          _id: "$conversationId",
          latestFeedbackDate: { $max: "$updatedAt" }
        }
      },
      {
        $lookup: {
          from: "conversations",
          localField: "_id",
          foreignField: "conversationId",
          as: "conversation"
        }
      },
      { $unwind: "$conversation" },
      {
        $lookup: {
          from: "messages",
          let: { messageIds: "$conversation.messages" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: ["$_id", "$$messageIds"]
                }
              }
            },
            { $sort: { createdAt: 1 } }
          ],
          as: "messagesData"
        }
      },
      {
        $lookup: {
          from: "users",
          let: {
            userIds: {
              $map: {
                input: {
                  $filter: {
                    input: "$messagesData",
                    as: "msg",
                    cond: { $eq: ["$$msg.sender", "User"] }
                  }
                },
                as: "msg",
                in: "$$msg.user"
              }
            }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    { $toString: "$_id" },
                    "$$userIds"
                  ]
                }
              }
            }
          ],
          as: "usersData"
        }
      },
      {
        $project: {
          _id: "$conversation._id",
          conversationId: "$conversation.conversationId",
          title: "$conversation.title",
          createdAt: "$conversation.createdAt",
          updatedAt: "$conversation.updatedAt",
          latestFeedbackDate: 1,
          resolved: "$conversation.resolved",

          messages: {
            $map: {
              input: "$messagesData",
              as: "msg",
              in: {
                messageId: "$$msg._id",
                sender: "$$msg.sender",
                createdAt: "$$msg.createdAt",
                updatedAt: "$$msg.updatedAt",
                model: "$$msg.model",
                feedback: "$$msg.feedback",
                text: {
                  $cond: [
                    { $eq: ["$$msg.sender", "User"] },
                    "$$msg.text",
                    null
                  ]
                },
                content: {
                  $cond: [
                    { $ne: ["$$msg.sender", "User"] },
                    "$$msg.content",
                    null
                  ]
                },
                user: {
                  $cond: [
                    { $eq: ["$$msg.sender", "User"] },
                    {
                      $let: {
                        vars: {
                          matchedUser: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: "$usersData",
                                  as: "u",
                                  cond: {
                                    $eq: [
                                      { $toString: "$$u._id" },
                                      "$$msg.user"
                                    ]
                                  }
                                }
                              },
                              0
                            ]
                          }
                        },
                        in: {
                          _id: "$$matchedUser._id",
                          name: "$$matchedUser.name",
                          username: "$$matchedUser.username",
                          email: "$$matchedUser.email"
                        }
                      }
                    },
                    null
                  ]
                }
              }
            }
          }
        }
      },
      { $sort: { latestFeedbackDate: -1 } },
      { $skip: skip },
      { $limit: limit }
    ];

    const result = await db
      .collection("messages")
      .aggregate(pipeline)
      .toArray();

    const countPipeline = [
      { $match: { feedback: { $exists: true } } },
      { $group: { _id: "$conversationId" } },
      { $count: "total" }
    ];

    const countResult = await db
      .collection("messages")
      .aggregate(countPipeline)
      .toArray();

    const totalCount = countResult.length > 0 ? countResult[0]!.total : 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Generate HTML with data embedded
    const html = generateViewerHTML(result, page, totalPages, totalCount, limit);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (err) {
    const error = err as Error;
    res.status(500).send(`<html><body><h1>Error loading data</h1><p>${error.message}</p></body></html>`);
  }
});

function generateViewerHTML(conversations: any[], page: number, totalPages: number, total: number, limit: number): string {
  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const renderContent = (content: any, msgId: string): string => {
    if (typeof content === 'string') {
      return `<div class="message-content">${escapeHtml(content)}</div>`;
    }

    if (Array.isArray(content)) {
      let html = '<div class="message-content">';
      let blockIndex = 0;
      content.forEach((block: any) => {
        if (block.type === 'text' && block.text) {
          html += `<div>${escapeHtml(block.text)}</div>`;
        } else if (block.type === 'think' && block.think) {
          const blockId = `${msgId}-think-${blockIndex}`;
          html += `
            <div class="content-block-wrapper">
              <div class="content-block-header" onclick="toggleBlock('${blockId}')">
                <span class="content-type">Thinking</span>
                <span class="toggle-icon" id="${blockId}-icon">▶</span>
              </div>
              <div class="content-block collapsed" id="${blockId}">
                <pre>${escapeHtml(block.think)}</pre>
              </div>
            </div>
          `;
          blockIndex++;
        } else if (block.type === 'tool_call' && block.tool_call) {
          const blockId = `${msgId}-tool-${blockIndex}`;
          const argsText = JSON.stringify(block.tool_call.args || {}, null, 2);
          html += `
            <div class="content-block-wrapper">
              <div class="content-block-header" onclick="toggleBlock('${blockId}')">
                <span class="content-type">Tool: ${escapeHtml(block.tool_call.name || 'Unknown')}</span>
                <span class="toggle-icon" id="${blockId}-icon">▶</span>
              </div>
              <div class="content-block collapsed" id="${blockId}">
                <pre>${escapeHtml(argsText)}</pre>
              </div>
            </div>
          `;
          blockIndex++;
        }
      });
      html += '</div>';
      return html;
    }

    return `<div class="message-content">${escapeHtml(JSON.stringify(content))}</div>`;
  };

  let conversationsHTML = '';

  if (conversations.length === 0) {
    conversationsHTML = `
      <div class="empty-state">
        <p>No conversations found</p>
      </div>
    `;
  } else {
    conversations.forEach((conv, convIndex) => {
      const createdDate = new Date(conv.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Count feedback messages
      const feedbackCount = conv.messages.filter((m: any) => m.feedback).length;
      const isResolved = conv.resolved === true;

      let messagesHTML = '';
      conv.messages.forEach((msg: any, msgIndex: number) => {
        const isUser = msg.sender === 'User';
        const messageClass = isUser ? 'user' : 'ai';
        const timestamp = new Date(msg.createdAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const msgId = `msg-${convIndex}-${msgIndex}`;

        let contentHTML = '';
        if (isUser && msg.text) {
          contentHTML = `<div class="message-content">${escapeHtml(msg.text)}</div>`;
        } else if (!isUser && msg.content) {
          contentHTML = renderContent(msg.content, msgId);
        }

        let userInfoHTML = '';
        if (isUser && msg.user) {
          userInfoHTML = `
            <div class="user-info">
              ${escapeHtml(msg.user.name || msg.user.username || 'Unknown')}
            </div>
          `;
        }

        let feedbackHTML = '';
        if (msg.feedback) {
          const rating = msg.feedback.rating;
          const tag = msg.feedback.tag || '';
          const feedbackText = msg.feedback.text || '';
          const ratingClass = rating === 'thumbsDown' ? 'negative' : rating === 'thumbsUp' ? 'positive' : '';
          const ratingIcon = rating === 'thumbsDown' ? '👎' : rating === 'thumbsUp' ? '👍' : '';

          feedbackHTML = `
            <div class="feedback-container ${ratingClass}">
              <div class="feedback-header">
                <span class="feedback-icon">${ratingIcon}</span>
                <span class="feedback-rating">${escapeHtml(rating)}</span>
                ${tag ? `<span class="feedback-tag">${escapeHtml(tag)}</span>` : ''}
              </div>
              ${feedbackText ? `<div class="feedback-text">${escapeHtml(feedbackText)}</div>` : ''}
            </div>
          `;
        }

        messagesHTML += `
          <div class="message ${messageClass} ${msg.feedback ? 'has-feedback' : ''}">
            <div class="message-header">
              <span class="sender">${escapeHtml(msg.sender)}${msg.model ? ` (${escapeHtml(msg.model)})` : ''}</span>
              <span class="timestamp">${timestamp}</span>
            </div>
            ${contentHTML}
            ${userInfoHTML}
            ${feedbackHTML}
          </div>
        `;
      });

      const convId = `conv-${convIndex}`;
      conversationsHTML += `
        <div class="conversation-card ${isResolved ? 'resolved' : ''}">
          <div class="conversation-header clickable" onclick="toggleConversation('${convId}')">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <span class="toggle-icon" id="${convId}-icon">▶</span>
              <span class="conversation-title">${escapeHtml(conv.title)}</span>
              ${isResolved ? '<span class="resolved-badge">✓ Resolved</span>' : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <label class="toggle-switch" onclick="event.stopPropagation()">
                <input type="checkbox" 
                       ${isResolved ? 'checked' : ''} 
                       onchange="toggleResolved('${conv.conversationId}', this.checked)">
                <span class="toggle-slider"></span>
              </label>
              <span class="feedback-count">${feedbackCount} feedback${feedbackCount !== 1 ? 's' : ''}</span>
              <span class="conversation-meta">${createdDate}</span>
            </div>
          </div>
          <div class="conversation-id">${conv.conversationId}</div>
          <div class="messages-container collapsed" id="${convId}">
            ${messagesHTML}
          </div>
        </div>
      `;
    });
  }

  // Generate page numbers
  let pageNumbers = '';
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, page + 2);

  if (startPage > 1) {
    pageNumbers += `<a href="/?page=1&limit=${limit}"><button>1</button></a>`;
    if (startPage > 2) {
      pageNumbers += `<span class="ellipsis">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers += `<a href="/?page=${i}&limit=${limit}"><button class="${i === page ? 'active' : ''}">${i}</button></a>`;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pageNumbers += `<span class="ellipsis">...</span>`;
    }
    pageNumbers += `<a href="/?page=${totalPages}&limit=${limit}"><button>${totalPages}</button></a>`;
  }

  const paginationHTML = totalPages > 0 ? `
    <div class="pagination">
      <a href="/?page=${page - 1}&limit=${limit}" ${page === 1 ? 'class="disabled"' : ''}>
        <button ${page === 1 ? 'disabled' : ''}>← Previous</button>
      </a>
      ${pageNumbers}
      <a href="/?page=${page + 1}&limit=${limit}" ${page === totalPages ? 'class="disabled"' : ''}>
        <button ${page === totalPages ? 'disabled' : ''}>Next →</button>
      </a>
    </div>
    <div class="pagination-info">
      Showing ${(page - 1) * limit + 1}-${Math.min(page * limit, total)} of ${total} conversations
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback Conversations</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            color: #333;
            line-height: 1.6;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        header {
            background: white;
            padding: 24px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        h1 {
            font-size: 28px;
            font-weight: 600;
            color: #333;
        }

        .conversation-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            transition: box-shadow 0.2s;
        }

        .conversation-card:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .conversation-card.resolved {
            background: #f0fdf4;
            border-color: #86efac;
        }

        .conversation-header {
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 1px solid #f0f0f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .conversation-header.clickable {
            cursor: pointer;
            user-select: none;
            padding: 8px;
            margin: -8px;
            border-radius: 4px;
            transition: background-color 0.2s;
        }

        .conversation-header.clickable:hover {
            background: #fafafa;
        }

        .resolved .conversation-header.clickable:hover {
            background: #dcfce7;
        }

        .toggle-icon {
            display: inline-block;
            color: #999;
            font-size: 12px;
            transition: transform 0.2s;
        }

        .toggle-icon.expanded {
            transform: rotate(90deg);
        }

        .collapsed {
            display: none !important;
        }

        .content-block-wrapper {
            margin-top: 8px;
        }

        .content-block-header {
            padding: 8px;
            background: #f5f5f5;
            border-radius: 4px;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .content-block-header:hover {
            background: #efefef;
        }

        .conversation-title {
            font-size: 16px;
            font-weight: 600;
            color: #333;
        }

        .resolved-badge {
            display: inline-block;
            padding: 2px 8px;
            background: #22c55e;
            color: white;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
        }

        .conversation-meta {
            font-size: 12px;
            color: #999;
        }

        .feedback-count {
            font-size: 12px;
            font-weight: 600;
            color: #666;
            background: #f0f0f0;
            padding: 4px 8px;
            border-radius: 12px;
        }

        .conversation-id {
            font-size: 11px;
            color: #ccc;
            font-family: monospace;
            margin-top: 2px;
            margin-bottom: 12px;
        }

        .messages-container {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .message {
            padding: 16px;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
            transition: border-color 0.2s;
        }

        .message.has-feedback {
            border-left: 3px solid #ffa500;
        }

        .message.user {
            background: #fafafa;
            margin-left: 40px;
        }

        .message.ai {
            background: white;
            margin-right: 40px;
        }

        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 12px;
            color: #666;
        }

        .sender {
            font-weight: 600;
        }

        .timestamp {
            color: #999;
            font-size: 11px;
        }

        .message-content {
            font-size: 14px;
            color: #333;
            line-height: 1.6;
        }

        .user-info {
            display: inline-block;
            padding: 4px 8px;
            background: #f5f5f5;
            border-radius: 4px;
            font-size: 11px;
            margin-top: 8px;
            color: #666;
        }

        .feedback-container {
            margin-top: 12px;
            padding: 12px;
            border-radius: 6px;
            border: 2px solid #e0e0e0;
            background: #fafafa;
        }

        .feedback-container.negative {
            border-color: #ff6b6b;
            background: #fff5f5;
        }

        .feedback-container.positive {
            border-color: #51cf66;
            background: #f0fdf4;
        }

        .feedback-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }

        .feedback-icon {
            font-size: 18px;
        }

        .feedback-rating {
            font-weight: 600;
            font-size: 13px;
            color: #333;
        }

        .feedback-tag {
            display: inline-block;
            padding: 2px 8px;
            background: #e0e0e0;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            color: #666;
        }

        .feedback-container.negative .feedback-tag {
            background: #ffe0e0;
            color: #c92a2a;
        }

        .feedback-container.positive .feedback-tag {
            background: #d3f9d8;
            color: #2b8a3e;
        }

        .feedback-text {
            font-size: 13px;
            color: #555;
            font-style: italic;
            margin-top: 4px;
            padding-top: 8px;
            border-top: 1px solid #e0e0e0;
        }

        .content-block {
            margin-top: 8px;
            padding: 8px;
            background: #fafafa;
            border-radius: 4px;
            border-left: 2px solid #ddd;
            font-size: 12px;
        }

        .content-type {
            font-weight: 600;
            color: #666;
            font-size: 10px;
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        /* Toggle Switch Styles */
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
        }

        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .3s;
            border-radius: 24px;
        }

        .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
        }

        .toggle-switch input:checked + .toggle-slider {
            background-color: #22c55e;
        }

        .toggle-switch input:checked + .toggle-slider:before {
            transform: translateX(20px);
        }

        .pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-top: 20px;
            padding: 16px;
            background: white;
            border-radius: 8px;
            border: 1px solid #e0e0e0;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            flex-wrap: wrap;
        }

        .pagination a {
            text-decoration: none;
        }

        .pagination a.disabled {
            pointer-events: none;
        }

        .ellipsis {
            padding: 0 8px;
            color: #999;
        }

        button {
            padding: 8px 16px;
            background: #666;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
            min-width: 44px;
        }

        button:hover:not(:disabled):not(.active) {
            background: #555;
        }

        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }

        button.active {
            background: #2563eb;
            font-weight: 600;
        }

        .pagination-info {
            text-align: center;
            font-size: 13px;
            color: #666;
            margin-top: 12px;
        }

        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #999;
        }

        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Feedback Conversations</h1>
        </header>

        ${conversationsHTML}
        ${paginationHTML}
    </div>
    <script>
        function toggleConversation(id) {
            const element = document.getElementById(id);
            const icon = document.getElementById(id + '-icon');
            if (element.classList.contains('collapsed')) {
                element.classList.remove('collapsed');
                icon.classList.add('expanded');
            } else {
                element.classList.add('collapsed');
                icon.classList.remove('expanded');
            }
        }

        function toggleBlock(id) {
            const element = document.getElementById(id);
            const icon = document.getElementById(id + '-icon');
            if (element.classList.contains('collapsed')) {
                element.classList.remove('collapsed');
                icon.classList.add('expanded');
            } else {
                element.classList.add('collapsed');
                icon.classList.remove('expanded');
            }
        }

        async function toggleResolved(conversationId, resolved) {
            try {
                const response = await fetch(\`/feedback-conversations/\${conversationId}/resolved\`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ resolved })
                });

                if (!response.ok) {
                    throw new Error('Failed to update resolved status');
                }

                // Reload the page to reflect changes
                window.location.reload();
            } catch (error) {
                console.error('Error toggling resolved status:', error);
                alert('Failed to update resolved status. Please try again.');
                // Revert the checkbox
                window.location.reload();
            }
        }
    </script>
</body>
</html>`;
}

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on 0.0.0.0:${PORT}`);
});

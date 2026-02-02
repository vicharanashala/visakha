import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "./db.js";
import { ObjectId } from "mongodb";

const app: express.Application = express();

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
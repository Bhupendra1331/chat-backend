import type { Request, Response } from "express";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import db from "../config/database";
import firestore from "../config/firebase";

function getPositiveId(value: unknown): number | null {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function getChatMessages(chatId: number) {
  return firestore
    .collection("chats")
    .doc(String(chatId))
    .collection("messages");
}

async function isChatMember(
  chatId: number,
  userId: number
): Promise<boolean> {
  const member = await db("chat_members")
    .where({ chat_id: chatId, user_id: userId })
    .first();

  return Boolean(member);
}

// 1. Create or get one-to-one chat
export async function createChat(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userAId = getPositiveId(req.body.userAId);
    const userBId = getPositiveId(req.body.userBId);

    if (!userAId || !userBId) {
      res.status(400).json({
        message: "userAId and userBId must be positive integers"
      });
      return;
    }

    if (userAId === userBId) {
      res.status(400).json({
        message: "A user cannot create a chat with themselves"
      });
      return;
    }

    const firstUserId = Math.min(userAId, userBId);
    const secondUserId = Math.max(userAId, userBId);

    const chatId = await db.transaction(async (trx) => {
      const users = await trx("users")
        .whereIn("id", [firstUserId, secondUserId])
        .select("id");

      if (users.length !== 2) {
        throw new Error("USER_NOT_FOUND");
      }

      let chat = await trx("chats")
        .where({
          user_a_id: firstUserId,
          user_b_id: secondUserId
        })
        .first();

      if (!chat) {
        try {
          const insertedIds = await trx("chats").insert({
            user_a_id: firstUserId,
            user_b_id: secondUserId
          });

          const newChatId = Number(insertedIds[0]);

          await trx("chat_members").insert([
            { chat_id: newChatId, user_id: firstUserId },
            { chat_id: newChatId, user_id: secondUserId }
          ]);

          return newChatId;
        } catch (error) {
          throw error;
        }
      }

      const existingChatId = Number(chat.id);

      // Ensure both members exist for an existing chat.
      await trx("chat_members")
        .insert([
          { chat_id: existingChatId, user_id: firstUserId },
          { chat_id: existingChatId, user_id: secondUserId }
        ])
        .onConflict(["chat_id", "user_id"])
        .ignore();

      return existingChatId;
    });

    res.status(200).json({
      message: "Chat created or already exists",
      chatId
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      res.status(404).json({ message: "One or both users not found" });
      return;
    }

    console.error("createChat error:", error);
    res.status(500).json({ message: "Failed to create chat" });
  }
}

// 2. Send a message
export async function sendMessage(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const chatId = getPositiveId(req.params.chatId);
    const senderId = getPositiveId(req.body.senderId);
    const text = req.body.text;

    if (!chatId || !senderId) {
      res.status(400).json({
        message: "chatId and senderId must be positive integers"
      });
      return;
    }

    if (typeof text !== "string" || !text.trim()) {
      res.status(400).json({ message: "text is required" });
      return;
    }

    if (text.length > 5000) {
      res.status(400).json({
        message: "Message cannot exceed 5000 characters"
      });
      return;
    }

    const member = await isChatMember(chatId, senderId);

    if (!member) {
      res.status(403).json({
        message: "Sender is not a member of this chat"
      });
      return;
    }

    const messageRef = await getChatMessages(chatId).add({
      senderId,
      text: text.trim(),
      createdAt: Timestamp.now(),
      readBy: [senderId]
    });

    res.status(201).json({
      message: "Message sent successfully",
      messageId: messageRef.id
    });
  } catch (error: unknown) {
    console.error("sendMessage error:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
}

// 3. Get messages in chronological order
export async function getMessages(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const chatId = getPositiveId(req.params.chatId);
    const requestedLimit = Number(req.query.limit ?? 50);

    if (!chatId) {
      res.status(400).json({ message: "Invalid chatId" });
      return;
    }

    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 100
    ) {
      res.status(400).json({
        message: "limit must be an integer between 1 and 100"
      });
      return;
    }

    const chat = await db("chats").where({ id: chatId }).first();

    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    // Fetch the latest messages first, then reverse to oldest-to-newest.
    const snapshot = await getChatMessages(chatId)
      .orderBy("createdAt", "desc")
      .limit(requestedLimit)
      .get();

    const messages = snapshot.docs.reverse().map((doc:any) => {
      const data = doc.data();
      const createdAt = data.createdAt as Timestamp;

      return {
        messageId: doc.id,
        senderId: data.senderId,
        text: data.text,
        createdAt: createdAt.toDate().toISOString(),
        readBy: data.readBy ?? []
      };
    });

    res.status(200).json({
      chatId,
      count: messages.length,
      messages
    });
  } catch (error: unknown) {
    console.error("getMessages error:", error);
    res.status(500).json({ message: "Failed to get messages" });
  }
}

// 4. Mark a message as read
export async function markMessageRead(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const chatId = getPositiveId(req.params.chatId);
    const userId = getPositiveId(req.body.userId);
  const messageId: unknown = req.body.messageId;

if (
  !chatId ||
  !userId ||
  typeof messageId !== "string" ||
  !messageId.trim()
) {
  res.status(400).json({
    message: "Valid chatId, userId and messageId are required"
  });
  return;
}

    const member = await isChatMember(chatId, userId);

    if (!member) {
      res.status(403).json({
        message: "User is not a member of this chat"
      });
      return;
    }

    const messageRef = getChatMessages(chatId).doc(messageId);
    const message = await messageRef.get();

    if (!message.exists) {
      res.status(404).json({ message: "Message not found" });
      return;
    }

    await messageRef.update({
      readBy: FieldValue.arrayUnion(userId)
    });

    res.status(200).json({
      message: "Message marked as read",
      chatId,
      messageId,
      userId
    });
  } catch (error: unknown) {
    console.error("markMessageRead error:", error);
    res.status(500).json({ message: "Failed to update read receipt" });
  }
}

// 5. Update last-seen message for a user
export async function updateLastSeen(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const chatId = getPositiveId(req.params.chatId);
    const userId = getPositiveId(req.body.userId);
 const messageId = req.body.messageId;

if (
  !chatId ||
  !userId ||
  typeof messageId !== "string" ||
  !messageId.trim()
) {
  res.status(400).json({
    message: "Valid chatId, messageId and userId are required"
  });
  return;
}

    const member = await isChatMember(chatId, userId);

    if (!member) {
      res.status(403).json({
        message: "User is not a member of this chat"
      });
      return;
    }

    const message = await getChatMessages(chatId).doc(messageId).get();

    if (!message.exists) {
      res.status(404).json({
        message: "Message not found in this chat"
      });
      return;
    }

    await firestore
      .collection("chats")
      .doc(String(chatId))
      .collection("lastSeen")
      .doc(String(userId))
      .set({
        messageId,
        updatedAt: Timestamp.now()
      });

    res.status(200).json({
      message: "Last seen updated",
      chatId,
      userId,
      messageId
    });
  } catch (error: unknown) {
    console.error("updateLastSeen error:", error);
    res.status(500).json({ message: "Failed to update last seen" });
  }
}

// 6. Get all chats of a user
export async function getUserChats(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = getPositiveId(req.params.userId);

    if (!userId) {
      res.status(400).json({
        message: "userId must be a positive integer"
      });
      return;
    }

    const user = await db("users").where({ id: userId }).first();

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const chats = await db("chat_members as mine")
      .join("chats", "chats.id", "mine.chat_id")
      .where("mine.user_id", userId)
      .select("chats.id", "chats.created_at")
      .orderBy("chats.created_at", "desc");

    const result = [];

    for (const chat of chats) {
      const members = await db("chat_members")
        .where({ chat_id: chat.id })
        .select("user_id");

      result.push({
        chatId: Number(chat.id),
        memberIds: members.map((member) => Number(member.user_id)),
        createdAt: chat.created_at
      });
    }

    res.status(200).json({
      userId,
      count: result.length,
      chats: result
    });
  } catch (error: unknown) {
    console.error("getUserChats error:", error);
    res.status(500).json({ message: "Failed to get user chats" });
  }
}
import { Router } from "express";
import {
  createChat,
  sendMessage,
  getMessages,
  markMessageRead,
  updateLastSeen,
  getUserChats
} from "../controllers/chat.controller";

const router = Router();

router.post("/chat/create", createChat);

router.post("/chat/:chatId/message/send", sendMessage);

router.get("/chat/:chatId/messages", getMessages);

router.post(
  "/chat/:chatId/message/:messageId/read",
  markMessageRead
);

router.post("/chat/:chatId/lastseen", updateLastSeen);

router.get("/user/:userId/chats", getUserChats);

export default router;
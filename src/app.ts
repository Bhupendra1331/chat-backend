import express from "express";
import chatRoutes from "./routes/chat.routes";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "success",
    message: "Chat backend is running"
  });
});

app.use("/", chatRoutes);

export default app;
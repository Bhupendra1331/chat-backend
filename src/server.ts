import "dotenv/config";
import app from "./app";
import db from "./config/database";

const port = Number(process.env.PORT || 3000);

async function startServer(): Promise<void> {
  try {
    // Check MySQL connection before starting the server.
    await db.raw("SELECT 1");

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error: unknown) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void startServer();
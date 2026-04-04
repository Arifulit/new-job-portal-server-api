import { createServer, Server } from "http";
import mongoose from "mongoose";
import { env } from "./app/config/env";
import app from "./app";
import { initSocketServer } from "./app/integrations/socket";

let server: Server | undefined;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const connectMongoWithRetry = async (dbUrl: string) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await mongoose.connect(dbUrl, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        family: 4,
      } as mongoose.ConnectOptions);
      return;
    } catch (error) {
      const err = error as any;
      const isDnsTxtTimeout =
        err?.code === "ETIMEOUT" &&
        err?.syscall === "queryTxt" &&
        typeof err?.hostname === "string";

      if (attempt < maxAttempts) {
        console.warn(
          `MongoDB connection attempt ${attempt}/${maxAttempts} failed. Retrying in 2s...`
        );
        await wait(2000);
        continue;
      }

      if (isDnsTxtTimeout && dbUrl.startsWith("mongodb+srv://")) {
        console.error("MongoDB Atlas DNS TXT lookup timed out.");
        console.error(
          "Your DNS server is resolving SRV records but timing out on TXT lookup for the Atlas host."
        );
        console.error("Fix options:");
        console.error("1) Change system DNS to 8.8.8.8 or 1.1.1.1 and retry.");
        console.error(
          "2) Use a non-SRV MongoDB URI in DB_URL/DB_URI (mongodb://host1,host2,host3/...) from Atlas 'Drivers' page."
        );
        console.error(
          "3) If using mobile hotspot/router DNS, switch network or configure router DNS manually."
        );
      }

      throw error;
    }
  }
};

const startServer = async () => {
  try {
    const dbUrl = env.DB_URL;
    if (!dbUrl) {
      throw new Error("Database URL not provided. Set DB_URL, DB_URI, or MONGODB_URI in environment or .env");
    }

    await connectMongoWithRetry(dbUrl);

    console.log("Connected to MongoDB successfully");

    // Create a raw HTTP server so Socket.IO can share the same port
    const httpServer = createServer(app);
    initSocketServer(httpServer);

    const port = env.PORT;
    server = httpServer.listen(port, () => {
      console.log(`Server is listening on port ${port}`);
      console.log(`Socket.IO is ready on ws://localhost:${port}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// graceful shutdown
const shutdown = (signal: string, code = 0) => async () => {
  console.log(`${signal} received. Shutting down...`);
  try {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      console.log("HTTP server closed.");
    }
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
    process.exit(code);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", shutdown("SIGTERM"));
process.on("SIGINT", shutdown("SIGINT"));

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection. Exiting...", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception. Exiting...", err);
  process.exit(1);
});
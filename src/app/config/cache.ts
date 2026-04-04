import { createClient } from "redis";
import { env } from "./env";

export const redisClient = createClient({
  url: process.env.REDIS_URL || `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
  password: env.REDIS_PASSWORD,
});

redisClient.on("error", (err) => console.error("❌ Redis error:", err));

export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("✅ Redis connected");
  }
};

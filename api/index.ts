import mongoose from "mongoose";
import app from "../src/app";
import { env } from "../src/app/config/env";

let connectPromise: Promise<typeof mongoose> | null = null;

const isHealthRequest = (url?: string) => {
	if (!url) return false;
	return url === "/health" || url === "/api/v1/health";
};

const ensureMongoConnection = async () => {
	if (mongoose.connection.readyState === 1) {
		return;
	}

	if (!connectPromise) {
		const mongoUri = env.DB_URI || env.DB_URL;
		if (!mongoUri) {
			throw new Error("MongoDB URI is not configured. Set DB_URL/DB_URI/MONGODB_URI in Vercel env.");
		}

		connectPromise = mongoose.connect(mongoUri, {
			serverSelectionTimeoutMS: 10000,
			connectTimeoutMS: 10000,
			family: 4,
		} as mongoose.ConnectOptions);
	}

	await connectPromise;
};

export default async function handler(req: any, res: any) {
	try {
		if (!isHealthRequest(req?.url)) {
			await ensureMongoConnection();
		}
		return app(req, res);
	} catch (error) {
		console.error("Vercel bootstrap error:", error);
		if (!res.headersSent) {
			return res.status(500).json({
				success: false,
				message: "Server initialization failed",
			});
		}
		return undefined;
	}
}
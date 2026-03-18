import { NextResponse } from "next/server";
import { GoogleAuth } from "google-auth-library";
import path from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "babbel-dev";
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "europe-west1";

let authClient: GoogleAuth | null = null;

function getAuthClient(): GoogleAuth {
  if (!authClient) {
    const base64Key = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (base64Key) {
      const credentials = JSON.parse(
        Buffer.from(base64Key, "base64").toString("utf-8")
      );
      authClient = new GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
    } else {
      const keyFilePath =
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        path.join(process.cwd(), "gcp-key.json");
      authClient = new GoogleAuth({
        keyFilename: keyFilePath,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
      });
    }
  }
  return authClient;
}

export async function GET() {
  try {
    const auth = getAuthClient();
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Failed to generate access token" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      accessToken,
      project: PROJECT,
      location: LOCATION,
      wsUrl: `wss://${LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`,
      model: `projects/${PROJECT}/locations/${LOCATION}/publishers/google/models/gemini-2.0-flash-live`,
    });
  } catch (error) {
    console.error("Failed to get Gemini config:", error);
    return NextResponse.json(
      { error: `Failed to authenticate: ${error}` },
      { status: 500 }
    );
  }
}

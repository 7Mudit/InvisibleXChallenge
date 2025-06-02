import { Webhook } from "svix";
import { headers } from "next/headers";
import { clerkClient, WebhookEvent } from "@clerk/nextjs/server";

const ALLOWED_DOMAIN = "@invisible.email";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("Missing clerk webhook secret in the environment");
    throw new Error("Missing clerk webhook secret in env");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.error("Missing one or more Svix headers");
    return new Response("Missing Svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (error) {
    console.error("Signature verification failed", error);
    return new Response("Invalid signature", { status: 400 });
  }

  const eventType = evt.type;

  if (eventType === "user.created") {
    const client = await clerkClient();
    const user = evt.data;
    const userId = user.id;
    const email = user.email_addresses?.[0]?.email_address;

    console.info("Clerk webhook recieved", { eventType, userId, email });

    try {
      if (!email || !email.endsWith(ALLOWED_DOMAIN)) {
        await client.users.deleteUser(userId);
        console.warn("User deleted due to invalid email domain", {
          userId,
          email,
        });
        return new Response("User deleted due to invalid email", {
          status: 200,
        });
      }

      await client.users.updateUserMetadata(userId, {
        publicMetadata: {
          role: "operator",
        },
      });
      console.info("Role 'operator' assigned", { userId, email });
    } catch (err) {
      console.error("Failed to updated user metadata or delete user", {
        err,
        userId,
      });
      return new Response("Internal server error", { status: 500 });
    }
  }

  return new Response("OK", { status: 200 });
}

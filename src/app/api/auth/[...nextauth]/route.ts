import type { NextRequest } from "next/server";
import NextAuth from "next-auth/next";

import { createEditorAuthOptions } from "@/modules/auth/editor-auth";

export const runtime = "nodejs";

type AuthRouteContext = Readonly<{ params: Promise<{ nextauth: string[] }> }>;

// Create the configuration per request. In particular, do not resolve OAuth
// credentials during `next build`, because public reader deployment must not
// become dependent on private editor configuration.
function handler(request: NextRequest, context: AuthRouteContext) {
  return NextAuth(request, context, createEditorAuthOptions());
}

export { handler as GET, handler as POST };

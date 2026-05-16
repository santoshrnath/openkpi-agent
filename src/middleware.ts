import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes that the public can hit without being signed in. Everything else
// requires Clerk session. Note: gateView() in our ACL still enforces
// per-workspace visibility on top of this, so a logged-in user without a
// Membership only sees PUBLIC workspaces.
// Public routes:
//   - / and marketing pages
//   - /sign-in, /sign-up (Clerk hosts the UI)
//   - /w/* — workspace pages; per-page gateView() enforces PUBLIC vs PRIVATE
//   - /invite/* — invite landing
//   - /api/cron/* — bearer-auth via CRON_SECRET, not Clerk
//   - /api/clerk/* — svix-signed webhooks
// Anything else requires a Clerk session.
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/about(.*)",
  "/brief(.*)",
  "/dax-sql(.*)",
  "/w(.*)",
  "/invite/(.*)",
  "/api/cron/(.*)",
  "/api/clerk/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static files
    "/((?!_next|.*\\..*).*)",
    // Always run on API + tRPC routes
    "/(api|trpc)(.*)",
  ],
};

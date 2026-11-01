import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("page.tsx"),
  route("account/signin", "account/signin/page.tsx"),
  route("account/logout", "account/logout.tsx"),
  route("account/forgot-password", "account/forgot-password.tsx"),
  route("account/reset-password", "account/reset-password.tsx"),
  route("dashboard", "dashboard/page.tsx"),
  route("preview/dashboard", "preview/dashboard.tsx"),
  route("preview/workspace", "preview/workspace.tsx"),
  route("preview/book", "preview/book.tsx"),
  route("preview/settings", "preview/operations.tsx", { id: "sample-settings" }),
  route("preview/assignments", "preview/operations.tsx", { id: "sample-assignments" }),
] satisfies RouteConfig;

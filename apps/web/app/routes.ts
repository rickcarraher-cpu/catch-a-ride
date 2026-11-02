import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("page.tsx"),
  route("account/signin", "account/signin/page.tsx"),
  route("account/logout", "account/logout.tsx"),
  route("account/forgot-password", "account/forgot-password.tsx"),
  route("account/reset-password", "account/reset-password.tsx"),
  route("dashboard", "dashboard/page.tsx"),
] satisfies RouteConfig;

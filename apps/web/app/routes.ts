import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("page.tsx"),
  route("account/signin", "account/signin/page.tsx"),
] satisfies RouteConfig;

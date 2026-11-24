import { handler } from "../../../../features/portfolio-api/production";

export const dynamic = "force-dynamic";
export const GET = handler("portfolios", "read");
export const PATCH = handler("portfolios", "update");

import { handler } from "../../../features/portfolio-api/production";

export const dynamic = "force-dynamic";
export const GET = handler("portfolios", "list");
export const POST = handler("portfolios", "create");

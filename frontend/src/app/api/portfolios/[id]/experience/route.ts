import { handler } from "../../../../../features/portfolio-api/production";

export const dynamic = "force-dynamic";
export const GET = handler("experience", "list");
export const POST = handler("experience", "create");

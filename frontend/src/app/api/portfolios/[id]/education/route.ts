import { handler } from "../../../../../features/portfolio-api/production";

export const dynamic = "force-dynamic";
export const GET = handler("education", "list");
export const POST = handler("education", "create");

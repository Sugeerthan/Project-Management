import { DASHBOARD_PATH, LOGIN_PATH } from "./routing";

/** Full navigation discards the previous authenticated Next.js client cache. */
export function replaceAuthLocation(path: typeof DASHBOARD_PATH | typeof LOGIN_PATH) {
  window.location.replace(path === DASHBOARD_PATH ? DASHBOARD_PATH : LOGIN_PATH);
}

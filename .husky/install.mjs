// Git hooks are only needed in local development with Husky installed.
if (
  process.env.NODE_ENV === "production" ||
  (process.env.CI && !["false", "0"].includes(process.env.CI)) ||
  process.env.VERCEL === "1" ||
  process.env.HUSKY === "0"
) {
  process.exit(0);
}

let huskyPath;
try {
  huskyPath = import.meta.resolve("husky");
} catch (error) {
  if (error.code === "ERR_MODULE_NOT_FOUND") process.exit(0);
  throw error;
}

const { default: husky } = await import(huskyPath);
console.log(husky());

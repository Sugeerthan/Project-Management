const config = {
  "frontend/**/!(next-env.d).{js,jsx,ts,tsx,mjs,cjs}": (files) => {
    // Run from the frontend so its existing flat config and Next.js paths resolve correctly.
    const args = files.map((file) => JSON.stringify(file)).join(" ");
    return `npm --workspace frontend exec -- eslint --max-warnings=0 ${args}`;
  },
  "*.{js,jsx,ts,tsx,mjs,cjs,json,md,mdx,css,scss,yaml,yml}": "prettier --check --ignore-unknown",
};

export default config;

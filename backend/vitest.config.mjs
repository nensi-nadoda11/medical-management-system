export default {
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    pool: "threads",
  },
};

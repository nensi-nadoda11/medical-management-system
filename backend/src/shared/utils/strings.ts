export const collapseWhitespace = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeEmail = (value: string) => collapseWhitespace(value).toLowerCase();

export const toSlug = (value: string) =>
  collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);

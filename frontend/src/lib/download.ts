import { apiClient } from "./api";

export const parseFilename = (header?: string | null, fallback = "download") => {
  if (!header) {
    return fallback;
  }

  const match = /filename="?([^"]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }, 1000);
};

export const downloadApiFile = async (
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  fallbackFilename: string,
) => {
  const response = await apiClient.get(path, {
    params: Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== ""),
    ),
    responseType: "blob",
  });

  downloadBlob(
    response.data,
    parseFilename(response.headers["content-disposition"], fallbackFilename),
  );
};

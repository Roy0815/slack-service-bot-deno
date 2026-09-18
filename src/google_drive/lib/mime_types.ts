const mimeTypes: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  txt: "text/plain",
  html: "text/html",
  csv: "text/csv",
  json: "application/json",
  doc: "application/msword",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * Guesses a MIME type from a file name's extension, used for files fetched
 * from a public URL where Slack cannot supply the mimetype itself.
 */
export function guessMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  return mimeTypes[extension] ?? "application/octet-stream";
}

export function quotePdfDownloadPath(quoteId: string, versionId: string) {
  return `/quotes/${quoteId}/versions/${versionId}/download`;
}

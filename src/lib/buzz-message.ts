export type BuzzSubmissionMessage = {
  fullName: string;
  applicationType: string;
  location?: string;
  notionUrl: string;
};

export function formatBuzzDisplayName(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
    .replace(/([\\`*_{}[\]()<>#+.!|\-])/g, "\\$1")
    .replace(/@/g, "@\u200b");
}

export function formatBuzzSubmissionMessage(submission: BuzzSubmissionMessage) {
  const summary = [submission.applicationType, submission.location].filter(Boolean).join(" · ");
  return [
    "🐝 **New club application**",
    `**${formatBuzzDisplayName(submission.fullName)}** submitted an application.`,
    summary,
    `[Open in Notion](${submission.notionUrl})`,
  ].filter(Boolean).join("\n");
}

export function formatBuzzDisplayName(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)
    .replace(/([\\`*_{}[\]()<>#+.!|\-])/g, "\\$1")
    .replace(/@/g, "@\u200b");
}

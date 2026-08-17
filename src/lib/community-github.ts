export interface CommunityGitHubRepository {
  owner: string;
  repository: string;
  url: string;
  label: string;
}

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPOSITORY_PATTERN = /^(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/;

export function getCommunityGitHubRepository(input: string): CommunityGitHubRepository | null {
  const value = input.trim();
  if (!value || value.startsWith("//") || value.startsWith("\\\\")) return null;
  if (/^https:\/\/github\.com:/i.test(value)) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "github.com" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.search ||
    parsed.hash
  ) {
    return null;
  }

  const pathMatch = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (!pathMatch) return null;

  const owner = pathMatch[1];
  const repository = pathMatch[2].endsWith(".git") ? pathMatch[2].slice(0, -4) : pathMatch[2];
  if (!OWNER_PATTERN.test(owner) || !REPOSITORY_PATTERN.test(repository)) return null;

  const url = `https://github.com/${owner}/${repository}`;
  return { owner, repository, url, label: `${owner}/${repository}` };
}

export function normalizeCommunityGitHubUrl(input: string): string | null {
  return getCommunityGitHubRepository(input)?.url ?? null;
}

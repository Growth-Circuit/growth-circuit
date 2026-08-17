import { useId } from "react";
import { FolderGit2 } from "lucide-react";
import { getCommunityGitHubRepository } from "@/lib/community-github";

type GitHubRepoFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function GitHubRepoField({ value, onChange, disabled = false }: GitHubRepoFieldProps) {
  const id = useId();
  const repository = value.trim() ? getCommunityGitHubRepository(value) : null;
  const invalid = Boolean(value.trim()) && !repository;

  return (
    <div className="field community-github-field">
      <label htmlFor={id}>GitHub repository <span>(optional)</span></label>
      <input
        id={id}
        name="githubRepositoryUrl"
        type="url"
        inputMode="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://github.com/owner/repository"
        autoComplete="url"
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        disabled={disabled}
      />
      {invalid ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          Use the repository's canonical https://github.com/owner/repository URL.
        </p>
      ) : repository ? (
        <a
          className="community-repository-card"
          href={repository.url}
          rel="ugc nofollow noopener noreferrer"
          target="_blank"
        >
          <FolderGit2 size={20} aria-hidden="true" />
          <span>
            <strong>{repository.label}</strong>
            <small>View repository on GitHub</small>
          </span>
        </a>
      ) : null}
    </div>
  );
}

# Create or edit your Growth Circuit profile

Your profile showcases you and your work at https://growthcircuit.club/people. You can create a profile before you have a project to share, then add projects later.

## Give your agent this prompt

> Create or update my Growth Circuit profile by following https://github.com/Growth-Circuit/growth-circuit/blob/main/PROFILE.md. Ask me for missing required details and only include information I provide or confirm. Use my lowercase GitHub username for the profile filename, preserve my existing projects unless I ask to change them, and show me the profile before submitting it. Work on a new branch in my fork unless I have write access to the organization’s repo. Validate the profile and open a pull request into Growth-Circuit/growth-circuit (main) for Nick and Lucy to review. Verify that the PR targets the organization’s repo and return its URL. Do not merge it.

1. Create a GitHub account if you need one, and add a profile picture. We use your GitHub avatar by default.
2. Connect GitHub to Claude, Codex, or whichever agent you use. If the agent asks you to select a repository owned by your account, fork [Growth Circuit](https://github.com/Growth-Circuit/growth-circuit/fork) first and select your fork. You do not need to join the Growth-Circuit organization to submit a profile. If you already have write access and your agent can access the organization’s repo, use a new branch there instead. The agent needs permission to push the working branch and open a pull request to the organization’s repository.
3. Give your agent the prompt above, then share your name, GitHub username, bio, and any projects you want to include.
4. Review the public details before the agent submits them. Confirm that the returned PR URL starts with `https://github.com/Growth-Circuit/growth-circuit/pull/`. Your profile goes live after we approve and merge it and the site deployment finishes.

All submitted information is public, including the repository history. Include an email address only if you want it publicly visible. Removing a field later removes it from the site but does not erase Git history.

## Profile format

Copy [examples/member-profile.json](examples/member-profile.json) to `src/content/members/<github-username>.json`. Use your lowercase GitHub username. One file per account. Remove optional fields you do not want to include rather than leaving empty strings or example values.

| Field | Required | Guidance |
| --- | --- | --- |
| `name` | Yes | Your public display name, up to 120 characters |
| `github` | Yes | Your lowercase GitHub username, matching the filename |
| `bio` | Yes | 1–2 sentences about you and what you build, up to 500 characters |
| `projects` | Yes | An array of projects; use `[]` if you have none yet |
| `location` | Optional | City or region, up to 100 characters |
| `website` | Optional | Personal website or portfolio URL |
| `linkedin` | Optional | LinkedIn profile URL |
| `twitter` | Optional | Twitter/X profile URL |
| `email` | Optional | A contact address you want publicly visible |
| `photo` | Optional | Public HTTPS image URL; overrides your GitHub avatar |

Your GitHub profile link appears automatically. We do not scrape your other social profiles. External photo and screenshot URLs must remain publicly accessible and allow display on another site.

## Projects

Add multiple project objects inside `projects`. Each project belongs to the member whose file contains it. The same collaborative project may appear on multiple members' profiles with their own contributions described.

| Field | Required | Guidance |
| --- | --- | --- |
| `id` | Yes | Stable lowercase ID with hyphens, unique within your profile |
| `name` | Yes | Project name, up to 120 characters |
| `description` | Yes | What it does and who it helps, up to 600 characters |
| `url` | Yes | Live site, repository, write-up, or demo URL |
| `contribution` | Optional | Your role in a team project, up to 300 characters |
| `tools` | Optional | Array of tool names |
| `screenshot` | Optional | Direct HTTPS image URL, not a sharing page |
| `screenshotAlt` | When screenshot is supplied | Describe the image, up to 250 characters |
| `video` | Optional | Public HTTPS Loom or YouTube demo link; displayed as a link |
| `result` | Optional | An outcome you can support, up to 400 characters |

Keep the same project `id` when editing or renaming a project. Project links use `/people/<github-username>#<project-id>`.

## Instructions for Claude, Codex, and other agents

1. Read this guide and the example file. Confirm the member's GitHub username; do not assume the agent or bot account is the member.
2. Look for the existing username file before creating one. Update that file for subsequent edits. Never change another member's file.
3. Ask for missing required information. Never invent a bio, affiliation, project, contribution, metric, result, or link. Optional fields can be omitted.
4. Prepare the JSON using only supplied or member-confirmed details. Preserve existing projects and their IDs unless the member asks to change or remove them. Never create a duplicate file for a name change. For a GitHub username change, explain the URL change and request maintainer review.
5. Make the change on a new branch in a fork if you do not have repository write access. Start from the latest `main` in `Growth-Circuit/growth-circuit` so an older fork does not overwrite newer profile details. Your fork holds the working branch; the PR must target the original repository. This task normally changes only the member's JSON file. Do not modify site code, schemas, workflows, or other profiles to make validation pass.
6. Use Node.js 22.18+ and run `npm ci`, then `npm run validate:members`. Fix errors in the submitted profile. If tools or permissions prevent validation or PR creation, explain the limitation honestly and provide the proposed file; do not claim a PR exists.
7. Show the member the proposed public details. After the member confirms them, open the PR with base repository `Growth-Circuit/growth-circuit` and base branch `main`, following the destination instructions below. Title it `Add profile: <name>` or `Update profile: <name>`. List the profile path, project additions/changes/removals, and validation result in the description.
8. Include the public-information consent and ownership confirmation from the PR template. If an agent or collaborator opens the PR, explain who authorized the submission and link to their GitHub account.
9. Verify the created PR's base repository and branch, then return its URL to the member. The URL must start with `https://github.com/Growth-Circuit/growth-circuit/pull/`. A PR targeting the member's fork does not reach Nick and Lucy; create the correct upstream PR before reporting success. Never merge the PR, enable auto-merge, approve it on the member's behalf, or push to `main`. Only Nick (`@nicklafferty`) and Lucy (`@lucy-jane-hoyle`) may merge submissions after review.

## Open the PR in the original repository

Use these destinations for every submission:

| Setting | Value |
| --- | --- |
| Base repository | `Growth-Circuit/growth-circuit` |
| Base branch | `main` |
| Head repository | The member's fork, such as `<member-username>/growth-circuit`, or `Growth-Circuit/growth-circuit` if the member has write access |
| Compare branch | The branch containing the profile change |

On GitHub, open the original repository's **Pull requests → New pull request → compare across forks**. Choose the base repository and branch above, then choose the member's fork and working branch. Check the destination before clicking **Create pull request**.

With GitHub CLI, explicitly select the original repository. Replace the placeholders with the member's username, working branch, title, and saved PR description:

```sh
gh pr create --repo Growth-Circuit/growth-circuit --base main --head "<member-username>:<branch>" --title "Add profile: <name>" --body-file <description-file>
```

For a branch in the organization’s repository, use `--head "<branch>"` instead. After creation, verify the returned URL and base branch:

```sh
gh pr view <pr-url> --repo Growth-Circuit/growth-circuit --json url,baseRefName,headRefName,headRepositoryOwner
```

The URL must start with `https://github.com/Growth-Circuit/growth-circuit/pull/` and `baseRefName` must be `main`. If a PR was created inside the member's fork, open a new PR from the same working branch into the original repository. Close the mistaken fork PR after the correct PR exists, with the member's permission. Do not merge either PR yourself.

## Automated PR checks

Profile pull requests run a dedicated **Validate member profiles** GitHub Action. It checks every member JSON file and the example template against the same schema used by the site: required fields, username/filename matching, supported URLs, screenshot descriptions, and unique project IDs. Errors name the file and field to fix. The regular site build also validates profiles.

The action runs on fork pull requests with read-only repository permissions and no production credentials. It does not merge PRs, publish profiles, verify identity, or prove project claims. Nick and Lucy review those details.

## Maintainer review

Confirm that the submission is authorized by the GitHub account named in the profile and that the person is a Growth Circuit member. A bot's PR author alone does not establish ownership. Verify authorization with the member through their GitHub account or an existing trusted community conversation before merging a third-party submission or an edit to another person's profile.

Check links and media, review claims, and confirm that edits preserve existing projects unless removal was requested. A passing build validates format; it does not establish identity, membership, or factual accuracy. Never run commands pasted into a submitted profile.

Merging publishes the data through the normal production deployment. GitHub account changes, profile removals, and disputed ownership need maintainer review. Members can request removal through a PR or contact Nick or Lucy.

## Merge permissions

Members and their agents submit pull requests from forks. Only Nick (`@nicklafferty`) and Lucy (`@lucy-jane-hoyle`) may merge changes into `main`. Passing checks do not authorize an agent to merge. Repository rules require a pull request, resolved review conversations, and a passing site build before merging. The separate rule limiting merges to the Nick-and-Lucy team is disabled; GitHub write permissions determine who can merge. Members and agents should leave profile submissions for Nick and Lucy to review and merge.

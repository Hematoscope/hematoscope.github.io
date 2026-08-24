import { execFileSync } from "node:child_process";

/**
 * When a file was last changed, according to git.
 *
 * A post's frontmatter carries the date it was published and nothing else, so
 * a post edited a year later still looks untouched to anything reading the
 * page. Asking git instead means the modified date is whatever the history
 * says, with nothing for an author to remember to bump and nothing that can
 * disagree with the commit that changed the prose.
 *
 * The commit date is the one to ask for, not the author date: a rebase or a
 * cherry-pick keeps the author date of the original work, which is the wrong
 * answer for "when did this page last change".
 *
 * Renames are followed, so moving a post to a new slug reports the edit that
 * moved it rather than resetting its history to that moment.
 */

// Resolution runs at build time and the same file is asked about more than
// once (the page, the sitemap, the feed), so memoize. A build sees one commit.
const cache = new Map<string, Date | undefined>();

export function gitModifiedDate(path: string): Date | undefined {
  const cached = cache.get(path);
  if (cached !== undefined || cache.has(path)) return cached;

  const date = readGitDate(path);
  cache.set(path, date);
  return date;
}

function readGitDate(path: string): Date | undefined {
  try {
    const stdout = execFileSync(
      "git",
      ["log", "--follow", "--max-count=1", "--format=%cI", "--", path],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();

    if (stdout === "") return undefined;
    const date = new Date(stdout);
    return Number.isNaN(date.valueOf()) ? undefined : date;
  } catch {
    // No git, no repository, or a checkout too shallow to hold the commit that
    // touched this file. The caller falls back to the published date, which is
    // wrong-but-plausible rather than absent; `.github/workflows/deploy.yml`
    // fetches full history so a release never takes that branch.
    return undefined;
  }
}

export async function getGitHubCommits(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=30`;
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  return response.json();
}

export async function getRepoFiles(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
  }
  const response = await fetch(url, { headers });
  return response.json();
}

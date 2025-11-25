import {getOctokit} from "@actions/github";
import * as core from "@actions/core";

/**
 * Get the repository owner and name from the GitHub context
 * @returns {Object} Object containing owner and repo
 */
export function getRepoInfo() {
  const repository = process.env.GITHUB_REPOSITORY || "";
  const [owner, repo] = repository.split("/");

  return {owner, repo};
}

/**
 * Get recent commits from a repository
 * @param {Object} options Options for getting commits
 * @param {string} options.token GitHub token
 * @param {string} options.owner Repository owner
 * @param {string} options.repo Repository name
 * @param {string} options.sha Branch or commit SHA (default: HEAD)
 * @param {number} options.count Number of commits to retrieve (default: 10)
 * @returns {Promise<Array>} Array of commit objects
 */
export async function getRecentCommits({
  token,
  owner,
  repo,
  sha = "HEAD",
  count = 10,
}) {
  const octokit = getOctokit(token);

  try {
    console.log(`Getting last ${count} commits from ${owner}/${repo} (${sha})`);

    const response = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha,
      per_page: count,
    });

    console.log(`Retrieved ${response.data.length} commits`);
    return response.data;
  } catch (error) {
    core.error(`Error getting recent commits: ${error.message}`);
    throw error;
  }
}

/**
 * Create a pull request
 * @param {Object} options Options for creating the PR
 * @param {string} options.token GitHub token
 * @param {string} options.owner Repository owner
 * @param {string} options.repo Repository name
 * @param {string} options.title PR title
 * @param {string} options.body PR body
 * @param {string} options.head Source branch
 * @param {string} options.base Target branch (default: main)
 * @returns {Promise<Object>} Created PR object
 */
export async function createPR({
  token,
  owner,
  repo,
  title,
  body,
  head,
  base = "main",
}) {
  const octokit = getOctokit(token);

  try {
    console.log(`Creating PR: ${title} (${head} -> ${base})`);

    const response = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });

    console.log(`Successfully created PR #${response.data.number}`);
    return response.data;
  } catch (error) {
    core.error(`Error creating PR: ${error.message}`);
    throw error;
  }
}

/**
 * Get file content from repository
 * @param {Object} options Options for getting the file
 * @param {string} options.token GitHub token
 * @param {string} options.owner Repository owner
 * @param {string} options.repo Repository name
 * @param {string} options.path File path (e.g., "CHANGELOG.md")
 * @param {string} options.branch Branch to read from (default: main)
 * @returns {Promise<string|null>} File content or null if file doesn't exist
 */
export async function getFileContent({
  token,
  owner,
  repo,
  path,
  branch = "main",
}) {
  const octokit = getOctokit(token);

  try {
    const fileResponse = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });

    if (fileResponse.data && !Array.isArray(fileResponse.data)) {
      // Decode base64 content
      const content = Buffer.from(
        fileResponse.data.content,
        "base64"
      ).toString("utf-8");
      return content;
    }

    return null;
  } catch (error) {
    if (error.status === 404) {
      // File doesn't exist
      return null;
    }
    core.error(`Error getting file content: ${error.message}`);
    throw error;
  }
}

/**
 * Update or create a file in the repository
 * @param {Object} options Options for updating the file
 * @param {string} options.token GitHub token
 * @param {string} options.owner Repository owner
 * @param {string} options.repo Repository name
 * @param {string} options.path File path (e.g., "CHANGELOG.md")
 * @param {string} options.content File content
 * @param {string} options.message Commit message
 * @param {string} options.branch Branch to commit to (default: main)
 * @returns {Promise<Object>} Commit object
 */
export async function updateOrCreateFile({
  token,
  owner,
  repo,
  path,
  content,
  message,
  branch = "main",
}) {
  const octokit = getOctokit(token);

  try {
    console.log(`Updating file ${path} on branch ${branch}`);

    // Get the current file SHA if it exists
    let sha = null;
    try {
      const fileResponse = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });
      if (fileResponse.data && !Array.isArray(fileResponse.data)) {
        sha = fileResponse.data.sha;
      }
    } catch (error) {
      // File doesn't exist, that's okay
      console.log(`File ${path} doesn't exist, will create it`);
    }

    // Encode content to base64
    const encodedContent = Buffer.from(content, "utf-8").toString("base64");

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: encodedContent,
      branch,
      sha, // If null, file will be created
    });

    console.log(`Successfully ${sha ? "updated" : "created"} file ${path}`);
    return response.data;
  } catch (error) {
    core.error(`Error updating file: ${error.message}`);
    throw error;
  }
}

/**
 * Create a new branch from a base branch
 * @param {Object} options Options for creating the branch
 * @param {string} options.token GitHub token
 * @param {string} options.owner Repository owner
 * @param {string} options.repo Repository name
 * @param {string} options.branchName New branch name
 * @param {string} options.baseBranch Base branch to branch from (default: main)
 * @returns {Promise<string>} SHA of the new branch
 */
export async function createBranch({
  token,
  owner,
  repo,
  branchName,
  baseBranch = "main",
}) {
  const octokit = getOctokit(token);

  try {
    console.log(`Creating branch ${branchName} from ${baseBranch}`);

    // Get the SHA of the base branch
    const baseRef = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });

    // Create the new branch
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseRef.data.object.sha,
    });

    console.log(`Successfully created branch ${branchName}`);
    return baseRef.data.object.sha;
  } catch (error) {
    // Branch might already exist, try to get it
    if (error.status === 422) {
      console.log(`Branch ${branchName} already exists, using it`);
      const existingRef = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      return existingRef.data.object.sha;
    }
    core.error(`Error creating branch: ${error.message}`);
    throw error;
  }
}

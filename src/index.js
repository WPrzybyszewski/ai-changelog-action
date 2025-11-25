import * as core from "@actions/core";
import {
  getRecentCommits,
  getRepoInfo,
  createPR,
  updateOrCreateFile,
  createBranch,
  getFileContent,
} from "./github-utils.js";
import {
  generateChangelogWithAI,
  formatChangelogEntry,
  updateChangelogFile,
  getCommitsForChangelog,
} from "./sumarize-changelog.js";

/**
 * Main function that orchestrates changelog generation and PR creation
 */
async function run() {
  try {
    // Get inputs and context
    const githubToken = process.env.GITHUB_TOKEN;
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const commitCount = parseInt(
      process.env.INPUT_COMMIT_COUNT || "10",
      10
    );
    const targetBranch =
      process.env.INPUT_BRANCH || process.env.GITHUB_BASE_REF || "main";

    if (!githubToken) {
      throw new Error("GITHUB_TOKEN is required");
    }

    if (!googleApiKey) {
      throw new Error("GOOGLE_API_KEY is required");
    }

    // Get repository info
    const {owner, repo} = getRepoInfo();
    console.log(`Processing repository: ${owner}/${repo}`);

    // Get recent commits
    console.log(`Fetching last ${commitCount} commits...`);
    const commits = await getRecentCommits({
      token: githubToken,
      owner,
      repo,
      sha: targetBranch,
      count: commitCount,
    });

    if (commits.length === 0) {
      console.log("No commits found, skipping changelog generation");
      return;
    }

    console.log(`Found ${commits.length} commits to analyze`);

    // Format commits for changelog
    const formattedCommits = getCommitsForChangelog(commits);

    // Generate changelog with AI
    console.log("Generating changelog with AI...");
    const aiChangelog = await generateChangelogWithAI(
      formattedCommits,
      googleApiKey,
      repo
    );

    // Format the changelog entry
    const changelogEntry = formatChangelogEntry(aiChangelog, repo);

    // Get existing CHANGELOG.md content from repository
    console.log("Fetching existing CHANGELOG.md from repository...");
    const existingContent =
      (await getFileContent({
        token: githubToken,
        owner,
        repo,
        path: "CHANGELOG.md",
        branch: targetBranch,
      })) || "";

    // Update CHANGELOG.md file content
    const {content: updatedContent, hasChanges} = updateChangelogFile(
      changelogEntry,
      repo,
      existingContent
    );

    if (!hasChanges) {
      console.log("No changes to CHANGELOG.md, skipping PR creation");
      return;
    }

    // Create a new branch for the changelog update
    const branchName = `changelog/update-${new Date()
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "")}`;
    console.log(`Creating branch: ${branchName}`);

    await createBranch({
      token: githubToken,
      owner,
      repo,
      branchName,
      baseBranch: targetBranch,
    });

    // Update CHANGELOG.md in the repository
    console.log("Updating CHANGELOG.md in repository...");
    await updateOrCreateFile({
      token: githubToken,
      owner,
      repo,
      path: "CHANGELOG.md",
      content: updatedContent,
      message: `chore: update CHANGELOG.md with recent changes`,
      branch: branchName,
    });

    // Create PR
    console.log("Creating pull request...");
    const pr = await createPR({
      token: githubToken,
      owner,
      repo,
      title: `chore: Update CHANGELOG.md`,
      body: `This PR updates the CHANGELOG.md with recent changes analyzed by AI.

Generated from the last ${commits.length} commits.`,
      head: branchName,
      base: targetBranch,
    });

    console.log(`Successfully created PR #${pr.number}: ${pr.html_url}`);
    core.setOutput("pr_number", pr.number);
    core.setOutput("pr_url", pr.html_url);
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
    console.error(error);
  }
}

// Run the main function
run();
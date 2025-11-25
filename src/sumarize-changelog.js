import {GoogleGenAI} from "@google/genai";

/**
 * Generates a changelog entry using Gemini Flash AI based on commit messages
 * @param {Array<Object>} commits Array of commit objects with sha, message, date, author
 * @param {string} apiKey Google AI API key
 * @param {string} repoName Repository name for the changelog header
 * @returns {Promise<string>} The AI-generated changelog entry
 */
export async function generateChangelogWithAI(commits, apiKey, repoName) {
  if (!commits || commits.length === 0) {
    throw new Error("No commits provided for changelog generation");
  }

  if (!apiKey) {
    throw new Error("Google API key is required");
  }

  const ai = new GoogleGenAI({apiKey});

  // Format commits for AI analysis
  const commitsText = commits
    .map((commit) => {
      const date = new Date(commit.date).toLocaleDateString("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return `- ${date}: ${commit.message} (${commit.sha.substring(0, 7)})`;
    })
    .join("\n");

  // Get date range
  const firstDate = new Date(commits[commits.length - 1].date);
  const lastDate = new Date(commits[0].date);
  const dateRange = `${firstDate.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })} - ${lastDate.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `
        You are a technical writer creating a changelog entry for a software project.
        Analyze the following commits and create a concise, professional changelog entry in Polish.

        Commits to analyze:
        ${commitsText}

        Requirements:
        1. Create a changelog entry in the following format:
           ### ${dateRange}
           
           - Brief description of change 1
           - Brief description of change 2
           - Brief description of change 3

        2. Group similar changes together
        3. Use clear, concise language in Polish
        4. Focus on user-visible changes and important technical improvements
        5. Ignore trivial changes like typo fixes unless they are significant
        6. Use bullet points starting with "- "
        7. Each bullet point should be on a new line
        8. Return ONLY the changelog entry (### date range and bullet points), nothing else
        9. Do not include the repository name or any other headers

        Example format:
        ### 07.04.2025 - 14.04.2025

        - Wdrożono poprawki do styli na stronie głównej
        - Zaktualizowano zależności w package.json
        - Wykonano modernizację kodu client-side (jQuery -> Svelte)
      `,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Error during AI changelog generation:", error);
    throw error;
  }
}

/**
 * Formats a changelog entry and ensures proper structure
 * @param {string} aiResponse Raw AI response
 * @param {string} repoName Repository name
 * @returns {string} Formatted changelog entry
 */
export function formatChangelogEntry(aiResponse, repoName) {
  // Clean up the AI response
  let entry = aiResponse.trim();

  // Ensure it starts with ###
  if (!entry.startsWith("###")) {
    // Try to extract the date range and format
    entry = `### ${entry}`;
  }

  // Ensure proper line breaks
  entry = entry.replace(/\n{3,}/g, "\n\n");

  return entry;
}

/**
 * Updates or creates CHANGELOG.md file content with new entry
 * @param {string} newEntry The new changelog entry to add
 * @param {string} repoName Repository name for header
 * @param {string} existingContent Existing CHANGELOG.md content (empty string if file doesn't exist)
 * @returns {{content: string, hasChanges: boolean}} Updated content and whether changes were made
 */
export function updateChangelogFile(newEntry, repoName, existingContent = "") {
  const header = `## ${repoName} - Changelog\n\n`;

  // Check if the entry already exists (simple check by date range)
  const dateRangeMatch = newEntry.match(/###\s+(\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}\.\d{2}\.\d{4})/);
  if (dateRangeMatch && existingContent.includes(dateRangeMatch[1])) {
    console.log("Changelog entry for this date range already exists");
    return {content: existingContent, hasChanges: false};
  }

  // Format the new content
  let newContent;
  if (existingContent.trim() === "" || !existingContent.includes(header.trim())) {
    // Create new file with header
    newContent = header + newEntry;
  } else {
    // Insert new entry after header
    const headerIndex = existingContent.indexOf(header);
    if (headerIndex !== -1) {
      const afterHeader = existingContent.substring(headerIndex + header.length);
      newContent = header + newEntry + "\n\n" + afterHeader;
    } else {
      // Header format might be different, prepend new entry
      newContent = header + newEntry + "\n\n" + existingContent;
    }
  }

  return {content: newContent, hasChanges: true};
}

/**
 * Gets commits formatted for changelog generation
 * @param {Array<Object>} commits Raw commits from GitHub API
 * @returns {Array<Object>} Formatted commits with sha, message, date, author
 */
export function getCommitsForChangelog(commits) {
  return commits.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message.split("\n")[0], // First line only
    date: commit.commit.author.date || commit.commit.committer.date,
    author: commit.commit.author.name,
  }));
}
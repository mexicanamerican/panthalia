import path from 'path';
import fs from 'fs';

import { sql } from '@vercel/postgres';
import { Octokit } from "octokit";
import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import { S3Image } from '../types/images';

import Post from '../types/posts'
import { generatePostContent } from '../utils/posts';
import {
  slugifyTitle,
  cloneRepoAndCheckoutBranch,
  commitAndPush
} from './git';

type GetResponseType = RestEndpointMethodTypes["pulls"]["create"]["response"];

// Octokit is the GitHub API client (used for opening pull requests)
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

const maxRetries = 5;

export async function waitForBranch(owner: string, repo: string, branch: string) {
  console.log(`waitForBranch: waiting for branch: ${branch} on ${owner}/${repo}`);
  for (let i = 1; i <= maxRetries; i++) {
    console.log(`waitForBranch on try number ${i}...`);
    try {
      // Attempt to get branch
      await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch
      }).then(() => {
        // Branch found
        console.log(`Branch found via GitHub API: ${branch}`);
      })
      // Success
      return;
    } catch (error) {
      // Branch not found yet
      // Exponential backoff
      const waitTime = i * 1000;
      console.log(`waitForBranch sleeping for ${waitTime} milliseconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error('Timeout waiting for branch')
}


export async function startGitProcessing(post: Post) {
  console.log(`startGitProcessing: %o`, post);

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  try {
    fetch(`${baseUrl}/api/git`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(post),
    });
  } catch (error) {
    console.log(`error: ${error}`);
  }
}

export async function startGitPostUpdates(post: Post) {
  console.log(`startGitPostUpdates: %o`, post);

  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';

  try {
    fetch(`${baseUrl}/api/git`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify(post),
    });
  } catch (error) {
    console.log(`error: ${error}`);
  }
}

interface leaderImageInfo {
  imageImportStatement: string;
  varName: string;
}

function getLeaderImageImportPathAndVarName(promptText: string): leaderImageInfo {
  // Form the leader image import statement so that it can be set in the post's metadata 
  // (thus rendering it as the hero image of the blog post)

  // Generate the camelCase variable name for the leader image
  const leaderImgVarName = hyphenToCamelCase(convertImagePromptToS3UploadPath(promptText));

  const leaderImageImportStatment = promptText ? `import ${leaderImgVarName} from '@/images/${convertImagePromptToS3UploadPath(promptText)}.png'` : '';

  const info: leaderImageInfo = {
    imageImportStatement: leaderImageImportStatment,
    varName: leaderImgVarName
  }

  return info
}

export async function updatePostWithOpenPR(updatedPost: Post) {
  console.log(`updatedPost data submitted to updatePostWithOpenPR function: %o`, updatedPost)

  // Ensure the post has an associated branchName 
  if (updatedPost.gitbranch === '') {
    console.log('updatedPost missing git branch information - cannot update existing PR')
    return
  }

  // Clone the repo and checkout the same branch associated with the open PR
  // We'll always need to re-clone the repo each time due to the nature of the ephemeral 
  // serverless environment the "backend" / Vercel functions are running in 
  const cloneUrl = await cloneRepoAndCheckoutBranch(updatedPost.gitbranch, true);
  console.log(`cloneUrl: ${cloneUrl}`);

  const leaderImgInfo = getLeaderImageImportPathAndVarName(updatedPost.leaderImagePrompt.text)

  // Generate post content
  const postContent = await generatePostContent(
    updatedPost.title,
    updatedPost.summary,
    updatedPost.content,
    leaderImgInfo.imageImportStatement,
    leaderImgInfo.varName
  );
  console.log(`postContent: ${postContent}`);

  // Write updated post file 
  const postFilePath = `src/pages/blog/${updatedPost.slug}.mdx`;
  console.log(`postFilePath: ${postFilePath}`);

  // Update post file in repo with new content
  fs.writeFileSync(path.join(cloneUrl, postFilePath), postContent)

  // Commit the update and push it on the existing branch 
  const update = true
  await commitAndPush(updatedPost.gitbranch, updatedPost.title, update);
}

export async function processPost(newPost: Post) {

  console.log(`newPost data submitted to processPost function: %o`, newPost)

  const slugifiedTitle = slugifyTitle(newPost.title);

  // The branch name for a given post is determined one time and then stored in the database for future reference
  // All subsequent times the branch name is needed it can be fetched from the database
  const branchName = `panthalia-${slugifiedTitle}-${Date.now()}`

  // Update the post record with the generated branch name and the slug
  const addBranchResult = await sql`
      UPDATE posts
      SET 
        gitbranch = ${branchName},
        slug = ${slugifiedTitle}
      WHERE id = ${newPost.id}
    `
  console.log(`Result of updating post with gitbranch: %o`, addBranchResult);

  // Clone my portfolio repository from GitHub so we can add the post to it
  const cloneUrl = await cloneRepoAndCheckoutBranch(branchName);
  console.log(`cloneUrl: ${cloneUrl}`);

  const leaderImgInfo = getLeaderImageImportPathAndVarName(newPost.leaderImagePrompt.text)

  // Generate post content
  const postContent = await generatePostContent(
    newPost.title,
    newPost.summary,
    newPost.content,
    leaderImgInfo.imageImportStatement,
    leaderImgInfo.varName
  );
  console.log(`postContent: ${postContent}`);

  // Write post file
  const postFilePath = `src/pages/blog/${slugifiedTitle}.mdx`;
  console.log(`postFilePath: ${postFilePath}`);

  // Write the post content to the expected path to add it as a blog post in my portfolio project
  fs.writeFileSync(path.join(cloneUrl, postFilePath), postContent)

  // Add new blog post and make an initial commit
  const update = false
  await commitAndPush(branchName, newPost.title, update);

  const prTitle = `Add blog post: ${newPost.title}`;
  const baseBranch = 'main'
  const body = `
      This pull request was programmatically opened by Panthalia (github.com/zackproser/panthalia)
    `
  const pullRequestURL = await createPullRequest(prTitle, branchName, baseBranch, body);

  // Associate the pull request URL with the post 
  const addPrResult = await sql`
      UPDATE posts
      SET githubpr = ${pullRequestURL}
      WHERE id = ${newPost.id}
    `

  console.log(`Result of updating post with githuburl: %o`, addPrResult);

  return
}


export async function createPullRequest(title: string, head: string, base: string, body: string) {

  console.log(`createPullRequest running...`)

  try {
    const response: GetResponseType = await octokit.rest.pulls.create({
      owner: "zackproser",
      repo: "portfolio",
      title,
      head,
      base,
      body
    });

    console.log(`Pull request URL: %s`, response.data.html_url);

    return response.data.html_url

  } catch (error) {

    console.log(`createPullRequest error: %o`, error);
  }
}







import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import { startBackgroundJobs } from '../../lib/jobs'
import Post from "../../types/posts";

import { getServerSession } from "next-auth/next"
import { authOptions } from '../../lib/auth/options'
import { imagePrompt } from '../../types/images';

export async function GET() {
  console.log('GET /api/posts route hit...')

  // Bounce the request if the user is not authenticated
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all posts 
    const result = await sql`
        SELECT * 
        FROM posts
      `;

    return NextResponse.json({ posts: result.rows }, {
      status: 200
    });

  } catch (error) {
    console.log(`error getting all posts from database: ${error}`);
  }
}


export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log('posts POST route hit...')

    const formData = await request.json()
    // console.log(`formData submitted: % o`, formData)

    const {
      title,
      slug,
      summary,
      content,
      ...formImagePrompts
    } = formData

    // Query to insert new blog post into the database
    const result = await sql`
      INSERT INTO posts(
      title,
      slug,
      summary,
      content,
      status
    )
      VALUES(
      ${title},
      ${slug},
      ${summary},
      ${content},
      'drafting'
    )
      RETURNING *;
    `;

    // Save the postId so we can use it to update the record with the pull request URL once it's available
    const newPost: Post = {
      id: result.rows[0].id,
      title,
      slug,
      summary,
      content,
      gitbranch: null,
      githubpr: null,
    }

    const promptsToProcess = formImagePrompts.imagePrompts as imagePrompt[]

    // Query to insert images into the database
    for (const promptToProcess of promptsToProcess) {
      // console.log(`promptToProcess: %o`, promptToProcess)

      const imgInsertResult = await sql`
        INSERT INTO 
        images(
          post_id,
          prompt_text)
         VALUES(
          ${newPost.id},
          ${promptToProcess.text}
        )
      `
    }

    // Fire and forget the initial post setup (git operations) and the image generation tasks
    startBackgroundJobs(newPost);

    return NextResponse.json({ result, success: true }, { status: 200 });

  } catch (error) {

    console.log(`error: ${error} `);

    return NextResponse.json({ error }, { status: 500 });

  }
}


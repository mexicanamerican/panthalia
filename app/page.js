'use client';

import { useState, useEffect } from 'react';

import { fetchPosts } from './utils/posts';

import Image from 'next/image'

export default function PostsPage() {

  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const posts = await fetchPosts();
      setPosts(posts);
    }
    fetchData();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-4">

      <div className="flex items-center p-6">
        <h1 className="text-3xl font-bold">Panthalia</h1>
        <img src="/panthalia-logo-2.png" className="h-36 w-36 rounded-md border border-gray-200 ml-4" />

      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map(post => (
          <div key={post.id} className="bg-white rounded-lg shadow overflow-hidden">

            {/* Show PR icon if post has a PR URL */}
            {post.githubpr &&
              <div>
                <h1>{post.githubr}</h1>
                <Image src={"/github-pr.svg"} width={24} height={24} />
              </div>

            }

            <div className="px-4 py-2">
              <h3 className="text-lg font-bold truncate">{post.title}</h3>
              <p className="text-gray-600 text-sm mt-1">{post.summary}</p>
              <p className="text-gray-600 text-sm mt-1">{post.githubpr}</p>
            </div>
            <div className="px-4 pt-2 pb-4">
              {post.status === 'published' &&
                <span className="bg-green-500 text-white text-xs font-bold mr-2 px-2 py-1 rounded">Published</span>
              }
              {post.status === 'draft' &&
                <span className="bg-yellow-500 text-white text-xs font-bold mr-2 px-2 py-1 rounded">Draft</span>
              }
              <a href={`/posts/${post.id}`} className="text-blue-500 text-sm font-bold">Read more</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


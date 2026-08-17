import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityPost, CommunityReply } from "@/types/community";
import { decodeFeedCursor, encodeFeedCursor, type CommunityPostView, type CommunityReplyView } from "@/lib/community";

type PostRow = Record<string, unknown> & { community_profiles?: unknown; viewer_votes?: unknown };
type ReplyRow = Record<string, unknown> & { community_profiles?: unknown };

function profileName(value: unknown) {
  const profile = Array.isArray(value) ? value[0] : value;
  if (!profile || typeof profile !== "object") return "Community member";
  const row = profile as Record<string, unknown>;
  return [row.first_name, row.last_name].filter((part): part is string => typeof part === "string" && part.length > 0).join(" ") || "Community member";
}

export function mapPost(row: PostRow, client?: SupabaseClient): CommunityPostView {
  const rawHeader = Array.isArray(row.header_image) ? row.header_image[0] : row.header_image;
  const header = rawHeader && typeof rawHeader === "object" ? rawHeader as Record<string, unknown> : null;
  void client;
  const headerImageUrl = header?.state === "ready" && typeof row.header_image_id === "string"
    ? `/api/community/media/${row.header_image_id}`
    : null;
  return {
    id: String(row.id),
    authorId: String(row.author_id),
    audience: row.audience as CommunityPost["audience"],
    state: row.publication_state as CommunityPost["state"],
    moderationState: row.moderation_state as CommunityPost["moderationState"],
    title: String(row.title),
    slug: String(row.slug),
    bodyMarkdown: String(row.body_markdown),
    githubRepositoryUrl: typeof row.github_repository_url === "string" ? row.github_repository_url : null,
    headerImageId: typeof row.header_image_id === "string" ? row.header_image_id : null,
    headerEnabled: Boolean(row.header_enabled),
    score: Number(row.score),
    replyCount: Number(row.reply_count),
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
    authorName: profileName(row.community_profiles),
    votedByViewer: Array.isArray(row.viewer_votes) && row.viewer_votes.length > 0,
    headerImageUrl,
  };
}

export function mapReply(row: ReplyRow): CommunityReplyView {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    authorId: String(row.author_id),
    audience: row.audience as CommunityReply["audience"],
    bodyMarkdown: String(row.body_markdown),
    moderationState: row.moderation_state as CommunityReply["moderationState"],
    score: Number(row.score),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : null,
    authorName: profileName(row.community_profiles),
  };
}

const POST_SELECT = "id,author_id,audience,publication_state,moderation_state,title,slug,body_markdown,github_repository_url,header_image_id,header_enabled,score,reply_count,published_at,created_at,updated_at,deleted_at,community_profiles!community_posts_author_id_fkey(first_name,last_name),header_image:community_images!community_posts_header_image_fk(bucket_id,object_path,state),viewer_votes:community_votes(user_id)";

export async function getCommunityFeed(
  client: SupabaseClient,
  options: { audience: "public" | "members"; cursor?: string | null; limit?: number },
) {
  const limit = Math.max(1, Math.min(options.limit || 20, 50));
  const cursor = options.cursor ? decodeFeedCursor(options.cursor) : null;
  if (options.cursor && !cursor) return { data: null, error: { code: "INVALID_CURSOR", message: "invalid cursor" } };

  let query = client.from("community_posts").select(POST_SELECT)
    .eq("audience", options.audience)
    .eq("publication_state", "published")
    .eq("moderation_state", "visible")
    .order("published_at", { ascending: false })
    .order("id", { ascending: false });
  if (cursor) {
    query = query.or(`published_at.lt.${cursor.publishedAt},and(published_at.eq.${cursor.publishedAt},id.lt.${cursor.id})`);
  }
  const { data, error } = await query.range(0, limit);
  if (error || !data) return { data: null, error };
  const hasMore = data.length > limit;
  const rows = data.slice(0, limit).map((row) => mapPost(row as PostRow, client));
  const last = rows.at(-1);
  return {
    data: {
      posts: rows,
      nextCursor: hasMore && last?.publishedAt ? encodeFeedCursor({ publishedAt: last.publishedAt, id: last.id }) : null,
    },
    error: null,
  };
}

export async function getOwnedDrafts(client: SupabaseClient) {
  const { data, error } = await client.from("community_posts").select(POST_SELECT)
    .eq("publication_state", "draft").order("updated_at", { ascending: false });
  return { data: data?.map((row) => mapPost(row as PostRow, client)) || null, error };
}

export async function getCommunityPost(client: SupabaseClient, id: string) {
  const { data, error } = await client.from("community_posts").select(POST_SELECT).eq("id", id).maybeSingle();
  return { data: data ? mapPost(data as PostRow, client) : null, error };
}

export async function getCommunityPostBySlug(client: SupabaseClient, slug: string) {
  const { data, error } = await client.from("community_posts").select(POST_SELECT)
    .eq("slug", slug).eq("publication_state", "published").eq("moderation_state", "visible").maybeSingle();
  return { data: data ? mapPost(data as PostRow, client) : null, error };
}

export async function createCommunityPost(client: SupabaseClient, input: {
  title: string; bodyMarkdown: string; audience: "public" | "members"; githubRepositoryUrl: string | null;
}) {
  const { data, error } = await client.rpc("community_create_post", {
    title_input: input.title,
    body_input: input.bodyMarkdown,
    audience_input: input.audience,
    github_repository_input: input.githubRepositoryUrl,
  });
  if (error || !data) return { data: null, error };
  return getCommunityPost(client, String((data as PostRow).id));
}

export async function updateCommunityPost(client: SupabaseClient, id: string, input: {
  title: string; bodyMarkdown: string; githubRepositoryUrl: string | null;
}) {
  const { data, error } = await client.rpc("community_update_post", {
    post_input: id,
    title_input: input.title,
    body_input: input.bodyMarkdown,
    github_repository_input: input.githubRepositoryUrl,
  });
  if (error || !data) return { data: null, error };
  return getCommunityPost(client, String((data as PostRow).id));
}

export async function softDeleteCommunityPost(client: SupabaseClient, id: string) {
  const { data, error } = await client.rpc("community_delete_post", { post_input: id });
  return { data: data ? mapPost(data as PostRow) : null, error };
}

export async function publishCommunityPost(client: SupabaseClient, id: string) {
  const { data, error } = await client.rpc("community_publish_post", { post_input: id });
  if (error || !data) return { data: null, error };
  return getCommunityPost(client, String((data as PostRow).id));
}

export async function getCommunityReplies(client: SupabaseClient, postId: string) {
  const { data, error } = await client.from("community_replies")
    .select("id,post_id,author_id,audience,body_markdown,moderation_state,score,created_at,updated_at,deleted_at,community_profiles(first_name,last_name)")
    .eq("post_id", postId).eq("moderation_state", "visible").is("deleted_at", null)
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(101);
  return {
    data: data?.slice(0, 100).map((row) => mapReply(row as ReplyRow)) || null,
    hasMore: Boolean(data && data.length > 100),
    error,
  };
}

export async function createCommunityReply(client: SupabaseClient, postId: string, bodyMarkdown: string) {
  const { data, error } = await client.rpc("community_create_reply", { post_input: postId, body_input: bodyMarkdown });
  if (error || !data) return { data: null, error };
  const { data: reply, error: readError } = await client.from("community_replies")
    .select("id,post_id,author_id,audience,body_markdown,moderation_state,score,created_at,updated_at,deleted_at,community_profiles(first_name,last_name)")
    .eq("id", String((data as ReplyRow).id)).maybeSingle();
  return { data: reply ? mapReply(reply as ReplyRow) : null, error: readError };
}

export async function toggleCommunityVote(client: SupabaseClient, postId: string) {
  const { data, error } = await client.rpc("community_toggle_vote", { post_input: postId });
  return { data: typeof data === "boolean" ? data : null, error };
}

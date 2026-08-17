export type CommunityAudience = "public" | "members";
export type CommunityPostState = "draft" | "published" | "deleted";
export type CommunityModerationState = "visible" | "hidden";
export type CommunityMembershipStatus = "active" | "suspended" | "revoked";
export type CommunityImageState = "staging" | "ready" | "deleted";

export interface CommunityProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  audience: CommunityAudience;
  state: CommunityPostState;
  moderationState: CommunityModerationState;
  title: string;
  slug: string;
  bodyMarkdown: string;
  githubRepositoryUrl: string | null;
  headerImageId: string | null;
  headerEnabled: boolean;
  score: number;
  replyCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CommunityImage {
  id: string;
  postId: string;
  authorId: string;
  audience: CommunityAudience;
  bucket: "community-public" | "community-private" | "community-staging";
  objectPath: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  byteSize: number;
  width: number | null;
  height: number | null;
  position: number;
  state: CommunityImageState;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  authorId: string;
  audience: CommunityAudience;
  bodyMarkdown: string;
  moderationState: CommunityModerationState;
  score: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CommunityLaunchState {
  writesEnabled: boolean;
  privateReadsEnabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

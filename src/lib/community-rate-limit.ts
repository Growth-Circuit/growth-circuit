export type DatabaseError = { code?: string; message?: string } | null | undefined;

export type NormalizedCommunityError = {
  status: number;
  code: string;
  message: string;
};

export function classifyCommunityError(error: DatabaseError): NormalizedCommunityError {
  const message = error?.message?.toLowerCase() || "";
  if (error?.code === "P0001" && message.includes("images are still processing")) {
    return { status: 409, code: "IMAGES_PROCESSING", message: "Wait for every image to finish processing, then publish again." };
  }
  if (error?.code === "P0001" && message.includes("rate limit")) {
    return {
      status: 429,
      code: "RATE_LIMITED",
      message: "You have created several posts recently. Please try again later.",
    };
  }
  if (error?.code === "22023" || error?.code === "23514") {
    return { status: 422, code: "INVALID_REQUEST", message: "Check the submitted fields and try again." };
  }
  if (error?.code === "42501" || error?.code === "PGRST116") {
    return { status: 404, code: "NOT_FOUND", message: "This community item is unavailable." };
  }
  return { status: 503, code: "TEMPORARILY_UNAVAILABLE", message: "The community is temporarily unavailable. Please try again." };
}

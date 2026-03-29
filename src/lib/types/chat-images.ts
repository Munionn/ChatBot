export type ChatMessageRowForImageSigning = {
  id: string;
  role: string;
  content: string;
  status?: string;
  created_at: string;
  model?: string | null;
};

export type MessageWithImages = ChatMessageRowForImageSigning & {
  imageUrls?: string[];
};

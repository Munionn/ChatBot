export type ChatSummary = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
};

export type ChatMessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  model?: string | null;
  imageUrls?: string[];
};

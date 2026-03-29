type ChatRole = "user" | "assistant" | "system";

type ChatTurn = {
  role: ChatRole;
  content: string;
};

export type StreamImage = {
  url: string;
  mimeType?: string;
};

export type ContextDoc = {
  title?: string;
  content: string;
};

export type StreamChatInput = {
  model: string;
  messages: ChatTurn[];
  images?: StreamImage[];
  lastUserImageDataUrls?: string[];
  contextDocs?: ContextDoc[];
  signal?: AbortSignal;
};

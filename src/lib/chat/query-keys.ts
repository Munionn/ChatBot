export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const
};

export const messageKeys = {
  all: ["messages"] as const,
  byChat: (chatId: string) => [...messageKeys.all, chatId] as const
};

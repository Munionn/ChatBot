import { z } from "zod";

export const createChatBodySchema = z.object({
  title: z.string().min(1).max(200).optional()
});

export const sendMessageBodySchema = z.object({
  content: z.string().min(1).max(32_000),
  model: z.string().min(1).max(200).optional(),
  documentIds: z.array(z.string().uuid()).max(8).optional(),
  attachmentIds: z.array(z.string().uuid()).max(6).optional()
});

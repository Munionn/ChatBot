import { redirect } from "next/navigation";

type HomeProps = {
  searchParams: Promise<{ code?: string; error?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const sp = await searchParams;
  if (sp.code ?? sp.error) {
    const q = new URLSearchParams();
    if (sp.code) q.set("code", sp.code);
    if (sp.error) q.set("error", sp.error);
    redirect(`/auth/callback?${q.toString()}`);
  }
  redirect("/chat");
}

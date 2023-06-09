import { summary, intro } from "wikipedia";

export async function search(query: string) {
  const { title } = await summary(query);
  const description = await intro(title);
  return { title, description };
}

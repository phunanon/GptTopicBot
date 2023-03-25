import { summary } from "wikipedia";

export async function search(query: string) {
  const { title, description } = await summary(query);
  return { title, description };
}

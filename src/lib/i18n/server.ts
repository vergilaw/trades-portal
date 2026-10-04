import "server-only";
import { headers } from "next/headers";
import { createTranslator, resolveLocale } from "./shared";
export async function getLocale() {
  return resolveLocale((await headers()).get("x-trades-locale"), undefined);
}
export async function getTranslator() {
  return createTranslator(await getLocale());
}

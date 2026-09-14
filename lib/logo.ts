import { readFile } from "node:fs/promises";
import { join } from "node:path";

const logoSrcPromise = readFile(
  join(process.cwd(), "public", "plinger-icon.png"),
  "base64",
).then((logoData) => `data:image/png;base64,${logoData}`);

export function getLogoSrc() {
  return logoSrcPromise;
}

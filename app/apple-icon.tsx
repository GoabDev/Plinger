import { ImageResponse } from "next/og";
import { getLogoSrc } from "../lib/logo";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

export default async function AppleIcon() {
  const logoSrc = await getLogoSrc();

  return new ImageResponse(
    <img src={logoSrc} alt="" width={180} height={180} />,
    size,
  );
}

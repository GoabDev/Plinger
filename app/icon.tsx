import { ImageResponse } from "next/og";
import { getLogoSrc } from "../lib/logo";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default async function Icon() {
  const logoSrc = await getLogoSrc();

  return new ImageResponse(
    <img src={logoSrc} alt="" width={32} height={32} />,
    size,
  );
}

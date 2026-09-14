import { ImageResponse } from "next/og";
import { getLogoSrc } from "../lib/logo";
import { siteDescription, siteName } from "../lib/site";

export const alt = `${siteName} dashboard preview`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const logoSrc = await getLogoSrc();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f7f7f9",
          color: "#15111f",
          fontFamily: "Arial",
          padding: 72,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            border: "1px solid #ded9e8",
            borderRadius: 32,
            background: "#ffffff",
            padding: 54,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
            }}
          >
            <img src={logoSrc} alt="" width={92} height={92} />
            <div style={{ display: "flex", fontSize: 42, fontWeight: 800 }}>
              {siteName}
              <span style={{ color: "#7c3aed" }}>.</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div
              style={{
                display: "flex",
                fontSize: 72,
                fontWeight: 800,
                lineHeight: 1.04,
                letterSpacing: 0,
                maxWidth: 850,
              }}
            >
              Your repositories. One clear picture.
            </div>
            <div
              style={{
                display: "flex",
                color: "#5d6070",
                fontSize: 30,
                lineHeight: 1.35,
                maxWidth: 860,
              }}
            >
              {siteDescription}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

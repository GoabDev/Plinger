import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Plinger home">
      <img src="/plinger-icon.png" alt="" width={34} height={34} />
      <span>
        Plinger<span className="brand-period">.</span>
      </span>
    </Link>
  );
}

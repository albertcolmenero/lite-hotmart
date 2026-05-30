import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div
          className="text-mono-sm"
          style={{ color: "var(--muted)", letterSpacing: "0.12em" }}
        >
          404
        </div>
        <h1 className="text-h1 mt-2">Page not found</h1>
        <p className="mt-2" style={{ color: "var(--lichen)" }}>
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <div className="mt-6">
          <Link href="/" className="btn btn-primary">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

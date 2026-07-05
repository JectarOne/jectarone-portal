import Link from "next/link";

export default function NotFound() {
  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <span className="brand" style={{ justifyContent: "center" }}><span className="mark">J</span><span>JectarOne<small>Client Portal</small></span></span>
        <h1 style={{ marginTop: "1rem" }}>Page not found</h1>
        <p className="sub">This page could not be found, or you don&rsquo;t have access to it.</p>
        <Link className="btn btn-primary btn-block" href="/dashboard">Back to dashboard</Link>
      </div>
    </div>
  );
}

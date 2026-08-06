import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      className="w-full border-t border-[var(--border)] mt-auto"
      data-testid="site-footer"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-[var(--muted)] uppercase tracking-wider">
          &copy; {new Date().getFullYear()} The Court. All rights reserved.
        </span>
        <Link
          to="/privacy"
          className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] hover:text-[var(--primary)]"
          data-testid="footer-privacy-link"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}

import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer
      className="w-full border-t border-white/10 mt-auto"
      data-testid="site-footer"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-neutral-500 uppercase tracking-wider">
          &copy; {new Date().getFullYear()} The Court. All rights reserved.
        </span>
        <Link
          to="/privacy"
          className="text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-[#FF3B30]"
          data-testid="footer-privacy-link"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  );
}

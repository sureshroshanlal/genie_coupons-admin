export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-8 mt-20">
      <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-8">
        <div>
          <h4 className="text-white font-semibold mb-3">HandPicked</h4>
          <p className="text-sm">
            Trusted by smart shoppers worldwide. Updated daily.
          </p>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Quick Links</h4>
          <ul className="text-sm space-y-2">
            <li><a href="/">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Popular Categories</h4>
          <ul className="text-sm space-y-2">
            <li><a href="/category/health-and-wellness">Health & Wellness</a></li>
            <li><a href="/category/fashion">Fashion</a></li>
            <li><a href="/category/game-hosting">Game Hosting</a></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-semibold mb-3">Stay Connected</h4>
          <p className="text-sm">Join our newsletter for weekly offers.</p>
        </div>
      </div>
      <div className="text-center text-xs mt-6 text-gray-500">
        © {new Date().getFullYear()} HandPicked. All rights reserved.
      </div>
    </footer>
  );
}
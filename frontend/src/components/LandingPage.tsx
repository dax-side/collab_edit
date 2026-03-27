interface LandingPageProps {
  onGetStarted: () => void;
}

export function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#f5f1e8] text-gray-900">
      {/* Header */}
      <header className="border-b-2 border-gray-900 bg-[#f5f1e8]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-900 flex items-center justify-center border-2 border-gray-900">
              <span className="text-sm font-bold text-[#f5f1e8]">CE</span>
            </div>
            <span className="font-bold text-xl">CollabEdit</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="hover:underline">
              Features
            </a>
            <a href="#how" className="hover:underline">
              How it works
            </a>
            <a href="#pricing" className="hover:underline">
              Pricing
            </a>
            <a href="#" className="hover:underline">
              Docs
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onGetStarted}
              className="text-sm font-medium hover:underline"
            >
              Sign in
            </button>
            <button
              onClick={onGetStarted}
              className="px-6 py-2.5 text-sm bg-gray-900 text-[#f5f1e8] font-bold uppercase tracking-wide border-2 border-gray-900 hover:bg-gray-800 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 border-b-2 border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div>
              <div className="inline-block mb-10">
                <span className="text-xs font-bold uppercase tracking-wider bg-gray-900 text-[#f5f1e8] px-3 py-1.5">
                  Real-time editing
                </span>
              </div>

              <h1 className="text-7xl font-bold mb-8 leading-[0.95]">
                Stop
                <br />
                emailing
                <br />
                docs.
              </h1>

              <p className="text-xl mb-12 leading-relaxed max-w-lg">
                CollabEdit keeps your team on the same document, same version, same moment — always.
              </p>

              <button
                onClick={onGetStarted}
                className="px-10 py-4 text-base bg-gray-900 text-[#f5f1e8] font-bold uppercase tracking-wide border-2 border-gray-900 hover:bg-gray-800 transition-colors"
              >
                Start editing free
              </button>

              <p className="text-sm mt-6 text-gray-600">
                No credit card required · Free tier available
              </p>
            </div>

            {/* Right: Stats + Product preview */}
            <div className="border-2 border-gray-900">
              {/* Stats Grid */}
              <div className="grid grid-cols-3 bg-white">
                <div className="border-r-2 border-gray-900 p-6">
                  <div className="text-4xl font-bold mb-2">0ms</div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-600">
                    Sync delay
                  </div>
                </div>

                <div className="border-r-2 border-gray-900 p-6 bg-[#f4d03f]">
                  <div className="text-4xl font-bold mb-2">0</div>
                  <div className="text-xs font-bold uppercase tracking-wide">
                    Merge conflicts
                  </div>
                </div>

                <div className="p-6">
                  <div className="text-4xl font-bold mb-2">100%</div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-600">
                    Open source
                  </div>
                </div>
              </div>

              {/* Product mockup */}
              <div className="bg-gray-900 border-t-2 border-gray-900">
                <div className="bg-gray-800 px-4 py-3 flex items-center gap-2 border-b-2 border-gray-700">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 bg-red-500 border border-gray-900"></div>
                    <div className="w-3 h-3 bg-yellow-400 border border-gray-900"></div>
                    <div className="w-3 h-3 bg-green-500 border border-gray-900"></div>
                  </div>
                  <span className="text-sm text-gray-400 ml-2 font-mono">meeting-notes.txt</span>
                  <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 bg-blue-500 border-2 border-gray-800 flex items-center justify-center text-white text-xs font-bold">
                        A
                      </div>
                      <div className="w-6 h-6 bg-green-500 border-2 border-gray-800 flex items-center justify-center text-white text-xs font-bold">
                        B
                      </div>
                      <div className="w-6 h-6 bg-orange-500 border-2 border-gray-800 flex items-center justify-center text-white text-xs font-bold">
                        C
                      </div>
                    </div>
                    <span className="font-mono">3 editing</span>
                  </div>
                </div>
                <div className="p-6 text-gray-300 font-mono text-sm leading-relaxed">
                  <p>Q1 Planning Meeting</p>
                  <p className="mt-3">• Launch features by March 15<span className="text-blue-400 animate-pulse">|</span></p>
                  <p>• Hire 2 engineers<span className="text-green-400 ml-1">✓</span></p>
                  <p>• Review pricing strategy<span className="text-orange-400 animate-pulse ml-1">...</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-b-2 border-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            <h2 className="text-5xl font-bold mb-4">Built different</h2>
            <p className="text-xl text-gray-600 max-w-2xl">
              The only editor that guarantees everyone sees the same thing, every time.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="border-2 border-gray-900 p-8 bg-white">
              <div className="text-xs font-bold uppercase tracking-wider bg-gray-900 text-[#f5f1e8] px-2 py-1 inline-block mb-6">
                Instant
              </div>
              <h3 className="text-2xl font-bold mb-4">Changes appear the instant they're typed</h3>
              <p className="text-gray-600 leading-relaxed">
                No refresh button. No "save and sync" delays. What they type, you see—instantly.
              </p>
            </div>

            <div className="border-2 border-gray-900 p-8 bg-white">
              <div className="text-xs font-bold uppercase tracking-wider bg-gray-900 text-[#f5f1e8] px-2 py-1 inline-block mb-6">
                Conflict-free
              </div>
              <h3 className="text-2xl font-bold mb-4">CRDT engine eliminates merge conflicts</h3>
              <p className="text-gray-600 leading-relaxed">
                Edit the same line at the same time. No "your changes overwrote mine" drama.
              </p>
            </div>

            <div className="border-2 border-gray-900 p-8 bg-[#f4d03f]">
              <div className="text-xs font-bold uppercase tracking-wider bg-gray-900 text-[#f5f1e8] px-2 py-1 inline-block mb-6">
                Offline-first
              </div>
              <h3 className="text-2xl font-bold mb-4">Keep editing when Wi-Fi drops</h3>
              <p className="leading-relaxed">
                Lost connection? Your changes sync when you're back online. No data lost.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 px-6 border-b-2 border-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-5xl font-bold mb-4">Start in 60 seconds</h2>
          </div>

          <div className="space-y-12">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-[#f4d03f] text-gray-900 flex items-center justify-center font-bold text-xl border-2 border-gray-900 shrink-0">
                1
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">Create a document</h3>
                <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
                  No installation, no setup. Click "New Doc" and you're in. Share the link with your team.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-[#f4d03f] text-gray-900 flex items-center justify-center font-bold text-xl border-2 border-gray-900 shrink-0">
                2
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-3">Invite your team</h3>
                <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
                  Email invite for full access, or share a read-only link with expiration for external reviews.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-[#f4d03f] text-gray-900 flex items-center justify-center font-bold text-xl border-2 border-gray-900 shrink-0">
                3
              </div>
              <div className="pb-4">
                <h3 className="text-2xl font-bold mb-3">Edit together</h3>
                <p className="text-gray-600 text-lg leading-relaxed max-w-2xl">
                  Everyone's changes appear instantly. No locks. No save buttons. Just type and it syncs.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-16">
            <h2 className="text-5xl font-bold mb-4">Pricing</h2>
            <p className="text-xl text-gray-600">
              Free for personal use. $12/user/month for teams.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border-2 border-gray-900 p-8 bg-[#f5f1e8]">
              <div className="text-xs font-bold uppercase tracking-wider mb-6">Personal</div>
              <div className="text-5xl font-bold mb-8">Free</div>
              <ul className="space-y-4 mb-10 text-gray-600">
                <li className="flex items-start gap-3">
                  <span className="text-xl">✓</span>
                  <span>Unlimited documents</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl">✓</span>
                  <span>Up to 3 collaborators</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl">✓</span>
                  <span>Real-time sync</span>
                </li>
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full py-3 bg-white border-2 border-gray-900 font-bold uppercase tracking-wide hover:bg-gray-900 hover:text-[#f5f1e8] transition-colors"
              >
                Get started
              </button>
            </div>

            <div className="border-2 border-gray-900 p-8 bg-[#f4d03f] relative">
              <div className="absolute -top-3 right-6 bg-gray-900 text-[#f5f1e8] px-3 py-1 text-xs font-bold uppercase">
                Popular
              </div>
              <div className="text-xs font-bold uppercase tracking-wider mb-6">Team</div>
              <div className="text-5xl font-bold mb-2">$12</div>
              <div className="text-sm mb-8">per user / month</div>
              <ul className="space-y-4 mb-10">
                <li className="flex items-start gap-3">
                  <span className="text-xl">✓</span>
                  <span>Everything in Personal</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl">✓</span>
                  <span>Unlimited collaborators</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl">✓</span>
                  <span>Share links with expiration</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-xl">✓</span>
                  <span>Priority support</span>
                </li>
              </ul>
              <button
                onClick={onGetStarted}
                className="w-full py-3 bg-gray-900 text-[#f5f1e8] font-bold uppercase tracking-wide border-2 border-gray-900 hover:bg-gray-800 transition-colors"
              >
                Start trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Separator */}
      <div className="border-t-2 border-gray-900"></div>

      {/* CTA */}
      <section className="py-20 px-6 bg-gray-900 text-[#f5f1e8]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-6xl font-bold mb-8 leading-tight">
            Ready to stop
            <br />
            emailing docs?
          </h2>
          <p className="text-xl mb-12 text-gray-300">
            Start your 14-day free trial. No credit card required.
          </p>
          <button
            onClick={onGetStarted}
            className="px-12 py-4 bg-[#f4d03f] text-gray-900 font-bold uppercase tracking-wide border-2 border-[#f4d03f] hover:bg-[#e5c536] transition-colors text-lg"
          >
            Get started free
          </button>
          <p className="text-base text-gray-400 mt-8">
            Built with custom CRDT · No libraries
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t-2 border-gray-900 bg-[#f5f1e8]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gray-900 flex items-center justify-center border-2 border-gray-900">
                  <span className="text-xs font-bold text-[#f5f1e8]">CE</span>
                </div>
                <span className="font-bold">CollabEdit</span>
              </div>
              <p className="text-sm text-gray-600">
                Real-time collaboration for modern teams.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4 uppercase text-xs tracking-wider text-gray-900">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:underline">Features</a></li>
                <li><a href="#" className="hover:underline">Pricing</a></li>
                <li><a href="#" className="hover:underline">Security</a></li>
                <li><a href="#" className="hover:underline">Changelog</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 uppercase text-xs tracking-wider text-gray-900">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:underline">Documentation</a></li>
                <li><a href="#" className="hover:underline">API</a></li>
                <li><a href="#" className="hover:underline">Support</a></li>
                <li><a href="#" className="hover:underline">Status</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4 uppercase text-xs tracking-wider text-gray-900">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><a href="#" className="hover:underline">About</a></li>
                <li><a href="#" className="hover:underline">Blog</a></li>
                <li><a href="#" className="hover:underline">Careers</a></li>
                <li><a href="#" className="hover:underline">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t-2 border-gray-900 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
            <p>&copy; 2026 CollabEdit</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="#" className="hover:underline">Privacy</a>
              <a href="#" className="hover:underline">Terms</a>
              <a href="#" className="hover:underline">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

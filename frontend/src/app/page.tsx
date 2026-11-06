const steps = [
  {
    title: "Upload your CV",
    description: "Start with your experience, education, and achievements.",
  },
  { title: "Review your story", description: "Shape your content and choose a portfolio theme." },
  {
    title: "Share your portfolio",
    description: "Preview your work before publishing your professional presence.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10 sm:py-16">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-slate-800 pb-6 text-lg font-semibold tracking-wide">
          Nexus Solutions
        </header>
        <section className="max-w-3xl py-16 sm:py-24" aria-labelledby="welcome-title">
          <p className="mb-5 text-sm font-medium uppercase tracking-widest text-cyan-300">
            Your next chapter
          </p>
          <h1
            id="welcome-title"
            className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl"
          >
            Turn your experience into a portfolio that tells your story.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-300">
            Automated Portfolio Management &amp; Generation Platform. Bring your skills, projects,
            and achievements together in one professional home.
          </p>
          <p className="mt-6 text-sm text-slate-400">Portfolio creation is coming soon.</p>
        </section>
        <section className="grid gap-6 md:grid-cols-3" aria-label="How portfolio creation works">
          {steps.map((step, index) => (
            <article
              key={step.title}
              className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <p className="text-sm font-semibold text-cyan-300">0{index + 1}</p>
              <h2 className="mt-4 text-xl font-semibold">{step.title}</h2>
              <p className="mt-3 leading-7 text-slate-300">{step.description}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

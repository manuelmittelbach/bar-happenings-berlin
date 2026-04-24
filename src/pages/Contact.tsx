export default function Contact() {
  return (
    <div className="container max-w-2xl py-16">
      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p className="text-base text-foreground">
          Questions, ideas, feedback? We'd love to hear from you.
        </p>

        <p>
          Drop us a line at{" "}
          <a
            href="mailto:hello@insidebars.co"
            className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
          >
            hello@insidebars.co
          </a>
        </p>
      </div>
    </div>
  );
}

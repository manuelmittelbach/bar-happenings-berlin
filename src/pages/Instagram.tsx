import { Link } from "react-router-dom";

export default function Instagram() {
  return (
    <div className="container max-w-2xl py-16">
      <div className="space-y-6 text-sm text-muted-foreground leading-relaxed">
        <p className="text-base text-foreground">
          No Instagram yet — looking for a collaborator.
        </p>

        <p>
          Inside Bars is a small, independent guide. We'd rather find the
          right person to run the feed than push out generic posts. If
          you're a photographer, writer, or just spend a lot of time in
          Berlin's bars and want to shape the voice with us, drop a line.
        </p>

        <p>
          Reach out at{" "}
          <a
            href="mailto:hello@insidebars.co"
            className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
          >
            hello@insidebars.co
          </a>{" "}
          or through our{" "}
          <Link
            to="/contact"
            className="text-foreground underline underline-offset-2 hover:text-accent transition-colors"
          >
            contact form
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

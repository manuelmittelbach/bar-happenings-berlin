import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsNative } from "@/hooks/useIsNative";

// Marketing surface for bar owners and event hosts. Auth lives on /signin
// (sign-in) and /signup (sign-up) — this page is intentionally form-free.
export default function ForBars() {
	const navigate = useNavigate();
	const { user } = useAuth();
	const isNative = useIsNative();

	return (
		<div className="flex flex-1 flex-col bg-background">
			{/* ─── 1 · HERO ─────────────────────────────────────────────
			    Editorial title block with dotted-grid wash, mirroring
			    About + Contact. */}
			<section className="relative overflow-hidden border-b-2 border-foreground">
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
					style={{
						backgroundImage:
							"linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
						backgroundSize: "48px 48px",
						maskImage:
							"radial-gradient(ellipse at 25% 50%, black 25%, transparent 80%)",
						WebkitMaskImage:
							"radial-gradient(ellipse at 25% 50%, black 25%, transparent 80%)",
					}}
				/>

				<div className="container relative px-4 py-16 md:py-24">
					<motion.h1
						initial={{ opacity: 0, y: 14 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.55, delay: 0.1 }}
						className="heading-display leading-[0.95]"
						style={{ fontSize: "clamp(36px, 5.6vw, 78px)" }}
					>
						Run a bar
						<br />
						<span className="heading-editorial italic lowercase font-light">in</span>{" "}
						Berlin
						<span className="text-accent">?</span>
					</motion.h1>

					<motion.p
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.18 }}
						className="mt-4 heading-editorial italic font-light text-foreground/55 leading-[1.2]"
						style={{ fontSize: "clamp(15px, 1.8vw, 22px)" }}
					>
						— or host an event in one?
					</motion.p>

					<motion.p
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.25 }}
						className="mt-8 max-w-xl text-balance text-lg leading-[1.5] text-foreground/75 md:text-xl"
					>
						Publish your events and reach people looking for something to do tonight.
					</motion.p>

					{user ? (
						<motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.35 }}
							className="mt-10 max-w-md border-l-2 border-foreground pl-4 py-2 space-y-2"
						>
							<p className="text-sm">
								Signed in as <strong className="font-mono">{user.email}</strong>.
							</p>
							<Link
								to="/profile"
								className="group inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-foreground hover:text-accent transition-colors"
							>
								Go to your account
								<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
							</Link>
						</motion.div>
					) : (
						<motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.35 }}
							className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-7"
						>
							<button
								onClick={() =>
									navigate("/signup", { state: { from: "/for-organizers", barOwner: true } })
								}
								className="group inline-flex items-center gap-2 h-12 px-6 border-2 border-foreground bg-foreground font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-background hover:bg-background hover:text-foreground active:scale-[0.98] transition-colors"
							>
								Create account
								<ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
							</button>
							<Link
								to="/signin"
								className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/55 hover:text-foreground transition-colors"
							>
								Already have an account? Sign in →
							</Link>
						</motion.div>
					)}
				</div>
			</section>

			{/* ─── 2 · TWO WAYS IN ─────────────────────────────────────
			    Two-column editorial spread mirroring About's
			    problem/fix split. Left column = bar owners. Right
			    column = event hosts. 2px vertical rule between. */}
			<section className="relative">
				<div className="container relative grid grid-cols-1 gap-12 px-4 py-16 md:grid-cols-2 md:gap-0 md:py-24">
					<div
						aria-hidden
						className="pointer-events-none absolute left-1/2 top-12 bottom-12 hidden w-[2px] -translate-x-1/2 bg-foreground md:block"
					/>

					<article className="md:pr-10 lg:pr-16">
						<div className="mb-4 flex items-baseline gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
							<span className="text-accent">01</span>
							For bar owners
						</div>
						<h2 className="heading-display text-3xl leading-[1.05] md:text-4xl">
							Claim your{" "}
							<span className="heading-editorial italic lowercase font-light">
								bar
							</span>
							<span className="text-accent">.</span>
						</h2>
						<p className="mt-5 text-[15px] leading-[1.65] text-foreground/75 md:text-base">
							Live music on weekends? Pub quiz on Tuesdays? List your bar and put your events on the map.
						</p>
					</article>

					<article className="md:pl-10 lg:pl-16">
						<div className="mb-4 flex items-baseline gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground/55">
							<span className="text-accent">02</span>
							For event hosts
						</div>
						<h2 className="heading-display text-3xl leading-[1.05] md:text-4xl">
							Host an{" "}
							<span className="heading-editorial italic lowercase font-light">
								event
							</span>
							<span className="text-accent">.</span>
						</h2>
						<p className="mt-5 text-[15px] leading-[1.65] text-foreground/75 md:text-base">
							DJing at a friend's bar? Running a pop-up? Publish it — no venue claim required.
						</p>
					</article>
				</div>
			</section>

			{isNative && (
				<nav
					aria-label="Legal"
					className="border-t-2 border-foreground/10 px-4 py-6 flex flex-wrap justify-center gap-x-6 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
				>
					<Link to="/impressum" className="hover:text-foreground transition-colors">
						Impressum
					</Link>
					<Link to="/datenschutz" className="hover:text-foreground transition-colors">
						Datenschutz
					</Link>
				</nav>
			)}
		</div>
	);
}

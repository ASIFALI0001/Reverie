/**
 * Design QA screenshots.
 *   npm run shots -- / /design --full --label=phase1
 * Flags: --full (also a full-page shot, after scrolling through to trigger reveals)
 *        --light (matinée theme)  --reduced (prefers-reduced-motion)  --only=desktop|mobile
 *        --hover=<css> (desktop: hover the first match)  --click=<css> (click the first match)
 * Env:   SHOTS_BASE (default http://localhost:3000)
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

// Routes may be given without the leading slash ("design", "." for home) so Git Bash
// on Windows doesn't rewrite them into filesystem paths.
const routes = args
  .filter((a) => !a.startsWith("--"))
  .map((r) => (r === "." ? "/" : r.startsWith("/") ? r : `/${r}`));
if (routes.length === 0) routes.push("/");

const base = process.env.SHOTS_BASE ?? "http://localhost:3000";
const label = opt("label") ?? "latest";
const theme = flag("light") ? "light" : "dark";
const only = opt("only");
const outDir = path.join(".qa", "shots", label);

const viewports = [
  { name: "desktop", width: 1440, height: 900, mobile: false },
  { name: "mobile", width: 390, height: 844, mobile: true },
].filter((v) => !only || v.name === only);

const slug = (route: string) => (route === "/" ? "home" : route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-"));

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      reducedMotion: flag("reduced") ? "reduce" : "no-preference",
    });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("reverie-theme", t);
      } catch {}
    }, theme);

    for (const route of routes) {
      const page = await context.newPage();
      page.on("console", (m) => {
        // Motion's dev-only notice is the expected outcome of --reduced, not a defect.
        if (m.text().includes("You have Reduced Motion enabled")) return;
        if (m.type() === "error" || m.type() === "warning") problems.push(`[${vp.name} ${route}] ${m.type()}: ${m.text()}`);
      });
      page.on("pageerror", (e) => problems.push(`[${vp.name} ${route}] pageerror: ${e.message}`));

      await page.goto(base + route, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(2200); // let the entrance choreography finish

      const name = `${slug(route)}-${vp.name}${theme === "light" ? "-light" : ""}`;
      await page.screenshot({ path: path.join(outDir, `${name}.png`) });

      // Interaction states: --hover=<css> and --click=<css> each add a shot of the element's state.
      const hover = opt("hover");
      if (hover && !vp.mobile) {
        const el = page.locator(hover).first();
        await el.scrollIntoViewIfNeeded();
        const box = await el.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.3, { steps: 8 });
          await page.waitForTimeout(900);
          await page.screenshot({ path: path.join(outDir, `${name}-hover.png`) });
        }
      }
      const click = opt("click");
      if (click) {
        await page.locator(click).first().click();
        await page.waitForTimeout(1100);
        await page.screenshot({ path: path.join(outDir, `${name}-click.png`) });
      }

      if (flag("full")) {
        await page.evaluate(async () => {
          const step = window.innerHeight * 0.6;
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 260));
          }
          window.scrollTo(0, 0);
        });
        // Deferred (content-visibility: auto) blocks only render near the viewport; a reader scrolling
        // sees them all, so render them for the capture too.
        await page.addStyleTag({ content: ".defer-render { content-visibility: visible !important; }" });
        await page.waitForTimeout(1600);
        await page.screenshot({ path: path.join(outDir, `${name}-full.png`), fullPage: true });
      }
      console.log(`shot ${name}`);
      await page.close();
    }
    await context.close();
  }

  await browser.close();
  if (problems.length) {
    console.log(`\n${problems.length} console problem(s):`);
    for (const p of [...new Set(problems)]) console.log("  " + p);
  } else {
    console.log("\nNo console errors or warnings.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

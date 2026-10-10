// globalSetup for the visual project: run a Playwright server in the official image so
// screenshots render the same on macOS, Linux and CI. Server version must match the
// installed client, so the image tag follows node_modules/playwright.
import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";

export const PW_PORT = 60001;

const { version } = createRequire(import.meta.url)("playwright/package.json") as {
  version: string;
};
const NAME = `owc-playwright-${PW_PORT}`;

// Any HTTP reply means run-server is listening (Docker's proxy accepts TCP before that).
const portOpen = () =>
  fetch(`http://127.0.0.1:${PW_PORT}/`, { signal: AbortSignal.timeout(1000) }).then(
    () => true,
    () => false,
  );

export default async function setup() {
  // Reuse a server someone already started (e.g. `docker run` in another terminal).
  if (await portOpen()) return;
  // Leftover from a killed run would hold the name.
  execFileSync("docker", ["rm", "-f", NAME], { stdio: "ignore" });
  const proc = spawn(
    "docker",
    [
      "run",
      "--rm",
      "--init",
      "--name",
      NAME,
      "-p",
      `${PW_PORT}:${PW_PORT}`,
      "--workdir",
      "/home/pwuser",
      "--user",
      "pwuser",
      `mcr.microsoft.com/playwright:v${version}-noble`,
      "/bin/sh",
      "-c",
      `xvfb-run npx -y playwright@${version} run-server --port ${PW_PORT} --host 0.0.0.0`,
    ],
    // Show pull/npx progress so a slow first run doesn't look frozen.
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  let exited = false;
  proc.once("exit", () => (exited = true));
  // First run pulls the image; each start npx-installs playwright in the container.
  for (const t0 = Date.now(); !(await portOpen());) {
    if (exited) throw new Error("Playwright Docker container exited; is Docker running?");
    if (Date.now() - t0 > 180_000) throw new Error("Playwright server did not come up in 3 min");
    await new Promise((r) => setTimeout(r, 500));
  }
  return () => {
    execFileSync("docker", ["rm", "-f", NAME], { stdio: "ignore" });
  };
}

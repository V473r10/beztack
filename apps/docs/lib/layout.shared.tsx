import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Beztack",
    },
    githubUrl: process.env.NEXT_PUBLIC_REPO_URL,
  };
}

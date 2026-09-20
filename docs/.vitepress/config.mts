import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "de-DE",
  title: "Slack Service Bot",
  description: "Documentation for slack-service-bot-deno",
  cleanUrls: true,
  base: "/slack-service-bot-deno/",
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "/slack-service-bot/favicon.ico",
      },
    ],
    [
      "link",
      {
        rel: "shortcut icon",
        href: "/slack-service-bot/favicon.ico",
      },
    ],
  ],
  themeConfig: {
    logo: {
      light: "/logo-sam-light.svg",
      dark: "/logo-sam-dark.svg",
    },
    siteTitle: "SAM Slack Service Bot",
    outline: { level: [2, 3], label: "Auf dieser Seite" },
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/Roy0815/slack-service-bot-deno",
      },
    ],
    search: { provider: "local" },
    docFooter: { next: "Nächste Seite", prev: "Vorherige Seite" },
    editLink: {
      pattern:
        "https://github.com/Roy0815/slack-service-bot-deno/edit/dev/docs/:path",
      text: "Auf GitHub editieren",
    },
    nav: [
      { text: "Home", link: "/" },
      { text: "Funktionen", link: "/functions/", activeMatch: "/functions/" },
      { text: "Setup", link: "/setup/", activeMatch: "/setup/" },
    ],
    sidebar: [
      {
        text: "Funktionen",
        link: "/functions/",
        collapsed: false,
        items: [
          { text: "Wer ist da?", link: "/functions/gym" },
        ],
      },
      {
        text: "Funktionen Admins",
        link: "/functions-admin/",
        collapsed: false,
        items: [
          { text: "Workflow Schritte", link: "/functions-admin/workflow-steps" },
        ],
      },
      {
        text: "Setup",
        link: "/setup/",
        collapsed: false,
        items: [],
      },
    ],
  },
});

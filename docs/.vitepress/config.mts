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
        href: "/slack-service-bot-deno/favicon.ico",
      },
    ],
    [
      "link",
      {
        rel: "shortcut icon",
        href: "/slack-service-bot-deno/favicon.ico",
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
        link:
          "https://github.com/Schwerathletik-Mannheim-2018-e-V/slack-service-bot-deno",
      },
    ],
    search: { provider: "local" },
    docFooter: { next: "Nächste Seite", prev: "Vorherige Seite" },
    editLink: {
      pattern:
        "https://github.com/Schwerathletik-Mannheim-2018-e-V/slack-service-bot-deno/edit/dev/docs/:path",
      text: "Auf GitHub editieren",
    },
    nav: [
      {
        text: "Anleitung",
        link: "/anleitung/mitglieder",
        activeMatch: "/anleitung/",
      },
      { text: "Technische Doku", link: "/technik/", activeMatch: "/technik/" },
      {
        text: "GitHub",
        link:
          "https://github.com/Schwerathletik-Mannheim-2018-e-V/slack-service-bot-deno",
      },
    ],
    // Anleitung: je eine Seite für Mitglieder und Admins, beide Gruppen immer
    // sichtbar; die Einträge springen zu den Abschnitten der Seite
    sidebar: {
      "/anleitung/": [
        {
          text: "Anleitung Mitglieder",
          link: "/anleitung/mitglieder",
          collapsed: false,
          items: [
            {
              text: "Rechnung einreichen",
              link: "/anleitung/mitglieder#rechnung-einreichen",
            },
            {
              text: "Stammdaten ändern",
              link: "/anleitung/mitglieder#stammdaten-aendern",
            },
            {
              text: "Kontodaten ändern",
              link: "/anleitung/mitglieder#kontodaten-aendern",
            },
            {
              text: "Coaching-Vertrag",
              link: "/anleitung/mitglieder#coaching-vertrag",
            },
            {
              text: "Eigene Workflows",
              link: "/anleitung/mitglieder#eigene-workflows",
            },
          ],
        },
        {
          text: "Anleitung Admins",
          link: "/anleitung/admins",
          collapsed: false,
          items: [
            { text: "Überblick", link: "/anleitung/admins#ueberblick" },
            {
              text: "Coaching-Vertrag",
              link: "/anleitung/admins#coaching-vertrag",
            },
            {
              text: "Rechnung einreichen",
              link: "/anleitung/admins#rechnung-einreichen",
            },
            {
              text: "Rechnung aus Nachricht",
              link: "/anleitung/admins#rechnung-aus-nachricht",
            },
            {
              text: "Genehmigung einholen",
              link: "/anleitung/admins#genehmigung",
            },
            {
              text: "Stammdaten ändern",
              link: "/anleitung/admins#stammdaten-aendern",
            },
            {
              text: "Kontodaten ändern",
              link: "/anleitung/admins#kontodaten-aendern",
            },
            {
              text: "Neues Mitglied",
              link: "/anleitung/admins#neues-mitglied",
            },
            { text: "Austritt einplanen", link: "/anleitung/admins#austritt" },
            {
              text: "Google Drive Ablage",
              link: "/anleitung/admins#google-drive",
            },
            {
              text: "Datum & URL Bausteine",
              link: "/anleitung/admins#bausteine",
            },
          ],
        },
      ],
      "/technik/": [
        {
          text: "Technische Doku",
          link: "/technik/",
          items: [
            { text: "Bot einrichten", link: "/technik/bot-einrichten" },
            { text: "Umgebungen & Secrets", link: "/technik/umgebungen" },
            { text: "Freigabe von Schritten", link: "/technik/freigaben" },
            { text: "Referenz Workflow-Schritte", link: "/technik/referenz" },
          ],
        },
      ],
    },
  },
});

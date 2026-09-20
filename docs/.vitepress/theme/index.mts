import { h, nextTick, watch } from "vue";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { createMermaidRenderer } from "vitepress-mermaid-renderer";
import { useData, useRouter } from "vitepress";
import "./style.css";
import * as auxiliary from "./themeAuxiliary.mjs";

export default {
  extends: DefaultTheme,
  Layout: () => {
    const { isDark } = useData();
    const router = useRouter();

    const renderMermaid = async () => {
      await nextTick();

      // createMermaidRenderer initialisiert mermaid selbst und rendert die
      // Diagramme automatisch, inkl. Reaktion auf Routenwechsel
      createMermaidRenderer({
        theme: isDark.value ? "dark" : "default",
      });

      // reagiert, wenn neue SVGs in den DOM kommen
      // Nur im Browser verfügbar
      if (typeof MutationObserver !== "undefined") {
        const observer = new MutationObserver((mutations) => {
          const added = mutations.some((m) =>
            Array.from(m.addedNodes).some((n) => n instanceof SVGElement)
          );
          if (added) requestAnimationFrame(() => auxiliary.tagActorGroups());
        });

        observer.observe(document.body, { childList: true, subtree: true });
      }

      // initiales Tagging nach dem ersten Render
      await auxiliary.waitForAllSVGs("svg > g", 400);
      auxiliary.tagActorGroups();
    };

    nextTick(() => renderMermaid());
    router.onAfterRouteChange = () => nextTick(() => renderMermaid());

    // bei Theme-Wechsel Mermaid neu rendern
    watch(
      () => isDark.value,
      () => nextTick(() => renderMermaid()),
    );

    return h(DefaultTheme.Layout);
  },
} satisfies Theme;

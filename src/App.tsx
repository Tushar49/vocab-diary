import { useEffect, useState } from "react";
import { setLang } from "./i18n";
import Library from "./ui/screens/Library";
import AddEdit from "./ui/screens/AddEdit";
import WordDetail from "./ui/screens/WordDetail";
import Study from "./ui/screens/Study";
import ProgressScreen from "./ui/screens/Progress";
import SettingsScreen from "./ui/screens/Settings";
import Translate from "./ui/screens/Translate";
import ImportScreen from "./ui/screens/Import";
import Onboarding from "./ui/screens/Onboarding";
import { loadSettings } from "./db/repo";
import type { Settings } from "./types";

export interface Route {
  page: string;
  param?: string;
  query: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, "");
  const [pathPart, queryPart] = raw.split("?");
  const segments = pathPart.split("/").filter(Boolean);
  return { page: segments[0] ?? "", param: segments[1], query: new URLSearchParams(queryPart ?? "") };
}

export function navigate(to: string): void {
  window.location.hash = to.startsWith("#") ? to : `#/${to.replace(/^\//, "")}`;
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLang("en");
      const dark =
        s.appearance === "dark" ||
        (s.appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    });
  }, []);

  if (!settings) return null;

  if (!settings.onboarded && route.page !== "onboarding") {
    return <Onboarding settings={settings} />;
  }

  switch (route.page) {
    case "add":
      return <AddEdit settings={settings} editId={route.param ? Number(route.param) : undefined} query={route.query} />;
    case "word":
      return <WordDetail settings={settings} id={Number(route.param)} />;
    case "study":
      return <Study settings={settings} />;
    case "progress":
      return <ProgressScreen settings={settings} />;
    case "settings":
      return <SettingsScreen settings={settings} onSettings={setSettings} />;
    case "translate":
      return <Translate settings={settings} initialText={route.query.get("text") ?? ""} />;
    case "import":
      return <ImportScreen settings={settings} />;
    case "onboarding":
      return <Onboarding settings={settings} />;
    default:
      return <Library settings={settings} addPrefill={route.query} />;
  }
}

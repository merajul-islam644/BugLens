import { BarChart3, Folder, LayoutDashboard, Microscope, Paperclip, ScanSearch, Settings } from "lucide-react";

export const navItems = [
  { adminOnly: false, badge: null, href: "/overview", icon: LayoutDashboard, labelKey: "nav.overview" },
  { adminOnly: false, badge: null, href: "/projects", icon: Folder, labelKey: "nav.projects" },
  { adminOnly: false, badge: null, href: "/issues", icon: ScanSearch, labelKey: "nav.issues" },
  { adminOnly: false, badge: "investigations", href: "/investigations", icon: Microscope, labelKey: "nav.investigations" },
  { adminOnly: false, badge: null, href: "/evidence", icon: Paperclip, labelKey: "nav.evidence" },
  { adminOnly: false, badge: null, href: "/reports", icon: BarChart3, labelKey: "nav.reports" },
  { adminOnly: true, badge: null, href: "/settings", icon: Settings, labelKey: "nav.settings" }
] as const;

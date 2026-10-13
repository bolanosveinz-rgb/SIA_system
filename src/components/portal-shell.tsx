"use client";

import { usePathname } from "next/navigation";
import { ResidentSidebar } from "@/components/resident-sidebar";

const residentPortalPaths = ["/", "/map", "/my-reports", "/profile"];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isResidentPortal = residentPortalPaths.some((path) => path === "/" ? pathname === path : pathname.startsWith(path));

  return isResidentPortal ? <ResidentSidebar>{children}</ResidentSidebar> : children;
}

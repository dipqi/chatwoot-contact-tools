"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Upload, Download, MessageSquare, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { href: "/", label: "Import & Label", icon: Upload },
    { href: "/export", label: "Export", icon: Download },
    { href: "/delete", label: "Mass Delete", icon: Trash2 },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-6 py-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                    <MessageSquare className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                    <h1 className="text-sm font-semibold">Chatwoot Tools</h1>
                    <p className="text-xs text-muted-foreground">Contact & Label Manager</p>
                </div>
            </div>

            <nav className="flex-1 space-y-1 p-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-accent text-accent-foreground"
                                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t border-border p-4">
                <p className="text-xs text-muted-foreground text-center">
                    &copy; {new Date().getFullYear()} <a href="https://dipqi.net" target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline transition-colors">Dipqi</a>
                </p>
            </div>
        </aside>
    );
}

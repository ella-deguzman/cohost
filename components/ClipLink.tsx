"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";

// The binder clip on the folder is the way in. Hovering lifts its handles, and
// clicking pops the clip off and swings the folder open before the next page loads.
export default function ClipLink({ href }: { href: string }) {
  const router = useRouter();

  function open(e: MouseEvent<HTMLAnchorElement>) {
    // New-tab clicks and keyboard shortcuts behave like any normal link.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // People who prefer less motion go straight to the next page.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    e.preventDefault();
    const stack = e.currentTarget.closest(".folder-stack");
    if (!stack || stack.classList.contains("opening")) return;
    stack.classList.add("opening");
    window.setTimeout(() => router.push(href), 800);
  }

  return (
    <Link className="clip-link" href={href} onClick={open} aria-label="Open your planner">
      <svg className="clip-svg" viewBox="0 0 150 110" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="clipMetal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#4a413a" />
            <stop offset="0.18" stopColor="#8a7d72" />
            <stop offset="0.34" stopColor="#3a322c" />
            <stop offset="0.62" stopColor="#6e635a" />
            <stop offset="0.82" stopColor="#2c2622" />
            <stop offset="1" stopColor="#4a413a" />
          </linearGradient>
          <linearGradient id="clipWire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f4f3f0" />
            <stop offset="0.5" stopColor="#a9a7a2" />
            <stop offset="1" stopColor="#dcdbd7" />
          </linearGradient>
        </defs>

        {/* silver wire handles; these lift when you hover */}
        <g className="clip-handle" style={{ transformOrigin: "94px 57px" }}>
          <path
            d="M96 40 L58 42 C34 43 10 46 8 57 C6 68 30 71 58 72 L96 74"
            fill="none"
            stroke="#6d6a66"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M96 39.5 L58 41.5 C34 42.5 10 45.5 8 56.5 C6 67.5 30 70.5 58 71.5 L96 73.5"
            fill="none"
            stroke="url(#clipWire)"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* dark chrome clip body */}
        <path
          d="M92 20 L146 24 Q150 24.5 150 29 L150 85 Q150 89.5 146 90 L92 94 Q88 94.3 88 90 L88 24 Q88 19.7 92 20 Z"
          fill="url(#clipMetal)"
        />
        <path d="M90 22 L148 26" stroke="#d9cfc6" strokeWidth="1" opacity="0.5" fill="none" />
        <path d="M90 92 L148 88" stroke="#000" strokeWidth="1" opacity="0.35" fill="none" />
        <g stroke="#000" strokeWidth="0.8" opacity="0.18">
          <path d="M104 24 V90" />
          <path d="M118 25 V89" />
          <path d="M132 26 V88" />
        </g>
        <rect x="85" y="34" width="9" height="46" rx="2" fill="#8d8780" />
        <rect x="85" y="34" width="3" height="46" rx="1.5" fill="#fff" opacity="0.3" />
      </svg>
      <span className="clip-label" aria-hidden="true">
        Open your planner
        <svg className="clip-arrow" viewBox="0 0 10 12" focusable="false">
          <path d="M5 11V2M1.5 5.5 5 2l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Link>
  );
}

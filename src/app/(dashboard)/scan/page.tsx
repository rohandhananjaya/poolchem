"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { AlertTriangle, Loader2, ScanLine, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { startVisitFromScan } from "./actions";

/** The element html5-qrcode mounts its <video> stream into. */
const READER_ID = "qr-reader";

type Status =
  | "starting" // initialising the camera
  | "scanning" // camera live, waiting for a code
  | "loading" // resolving a code into a visit
  | "not-found" // code resolved to no pool in this company
  | "denied" // user blocked camera access
  | "no-camera"; // no usable camera (typical on desktop)

/** True for the getUserMedia errors that mean the user refused permission. */
function isPermissionError(error: unknown): boolean {
  const name =
    typeof error === "object" && error && "name" in error
      ? String((error as { name: unknown }).name)
      : String(error);
  return /NotAllowed|Permission|Security/i.test(name);
}

export default function ScanPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>("starting");
  const [manualCode, setManualCode] = React.useState("");
  // Bumping this re-runs the camera effect (used by "Scan again").
  const [session, setSession] = React.useState(0);

  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  // Guards against the decode callback firing repeatedly for one code.
  const handledRef = React.useRef(false);

  // Whether we should be running the camera this render.
  const cameraActive = status === "starting" || status === "scanning";

  const resolveCode = React.useCallback(
    async (code: string) => {
      setStatus("loading");
      const result = await startVisitFromScan(code);
      if (result.ok) {
        router.push(`/visits/${result.visitId}`);
        return;
      }
      // Allow another attempt (manual entry or a fresh scan).
      handledRef.current = false;
      setStatus("not-found");
    },
    [router],
  );

  // Own the camera lifecycle. Re-runs when we (re)start a scan session.
  React.useEffect(() => {
    if (!cameraActive) return;

    const scanner = new Html5Qrcode(READER_ID, { verbose: false });
    scannerRef.current = scanner;
    let cancelled = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          void resolveCode(decodedText);
        },
        // Per-frame "no code in view" — expected noise, ignore it.
        () => {},
      )
      .then(() => {
        if (!cancelled) setStatus("scanning");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(isPermissionError(error) ? "denied" : "no-camera");
      });

    return () => {
      cancelled = true;
      // stop() rejects if the camera never started; swallow either way.
      scanner
        .stop()
        .catch(() => {})
        .finally(() => scanner.clear());
      scannerRef.current = null;
    };
    // `session` drives an explicit restart; cameraActive gates on/off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, cameraActive]);

  function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!manualCode.trim() || status === "loading") return;
    handledRef.current = true;
    void resolveCode(manualCode);
  }

  function scanAgain() {
    setManualCode("");
    handledRef.current = false;
    setStatus("starting");
    setSession((n) => n + 1);
  }

  const cameraFailed = status === "denied" || status === "no-camera";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Live camera stream fills the screen; object-cover avoids letterboxing. */}
      <div
        id={READER_ID}
        className={cn(
          "absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover",
          !cameraActive && "hidden",
        )}
      />

      {/* Top bar: title + cancel. */}
      <header className="relative z-10 flex items-center justify-between gap-3 p-4">
        <h1 className="text-base font-semibold tracking-tight">Scan pool QR</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          aria-label="Cancel"
          className="text-white hover:bg-white/15 hover:text-white"
        >
          <X className="size-5" />
        </Button>
      </header>

      {/* Scanning viewfinder overlay — only while the camera is live. */}
      {status === "scanning" ? (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <div className="relative size-64 max-w-[80vw]">
            {/* Corner brackets */}
            <span className="absolute left-0 top-0 size-8 rounded-tl-lg border-l-4 border-t-4 border-white" />
            <span className="absolute right-0 top-0 size-8 rounded-tr-lg border-r-4 border-t-4 border-white" />
            <span className="absolute bottom-0 left-0 size-8 rounded-bl-lg border-b-4 border-l-4 border-white" />
            <span className="absolute bottom-0 right-0 size-8 rounded-br-lg border-b-4 border-r-4 border-white" />
          </div>
        </div>
      ) : null}

      {/* Foreground content: instructions / loading / errors / manual entry. */}
      <div className="relative z-10 mt-auto flex flex-col items-center gap-4 p-6 pb-10">
        {status === "starting" ? (
          <p className="flex items-center gap-2 text-sm text-white/80">
            <Loader2 className="size-4 animate-spin" /> Starting camera…
          </p>
        ) : null}

        {status === "scanning" ? (
          <p className="flex items-center gap-2 rounded-full bg-black/50 px-4 py-2 text-sm text-white/90 backdrop-blur-sm">
            <ScanLine className="size-4" /> Point the camera at a pool&apos;s QR
            code
          </p>
        ) : null}

        {status === "loading" ? (
          <p className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-sm text-white backdrop-blur-sm">
            <Loader2 className="size-4 animate-spin" /> Loading pool data…
          </p>
        ) : null}

        {status === "not-found" ? (
          <div className="w-full max-w-sm rounded-xl bg-white/10 p-4 text-center backdrop-blur-sm">
            <p className="flex items-center justify-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 text-amber-400" /> Pool not found
            </p>
            <p className="mt-1 text-xs text-white/70">
              That code doesn&apos;t match a pool in your account. Try again or
              enter it manually below.
            </p>
            <Button
              variant="outline"
              size="lg"
              onClick={scanAgain}
              className="mt-3 border-white/30 bg-transparent text-white hover:bg-white/15 hover:text-white"
            >
              Scan again
            </Button>
          </div>
        ) : null}

        {cameraFailed ? (
          <div className="w-full max-w-sm rounded-xl bg-white/10 p-4 text-center backdrop-blur-sm">
            <p className="flex items-center justify-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 text-amber-400" />
              {status === "denied" ? "Camera access blocked" : "No camera found"}
            </p>
            <p className="mt-1 text-xs text-white/70">
              {status === "denied"
                ? "Allow camera access in your browser to scan, or enter the QR code manually."
                : "Enter the pool's QR code manually to continue."}
            </p>
          </div>
        ) : null}

        {/* Manual entry: always offered as a fallback, plus after a miss. */}
        {status === "not-found" || cameraFailed ? (
          <form
            onSubmit={handleManualSubmit}
            className="flex w-full max-w-sm items-center gap-2"
          >
            <Input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              placeholder="Enter QR code manually"
              aria-label="Enter QR code manually"
              autoFocus
              className="border-white/30 bg-white/10 text-white placeholder:text-white/50"
            />
            <Button
              type="submit"
              size="lg"
              disabled={!manualCode.trim()}
              className="shrink-0"
            >
              Go
            </Button>
          </form>
        ) : null}

        <Button
          variant="ghost"
          size="lg"
          onClick={() => router.back()}
          className="text-white/80 hover:bg-white/15 hover:text-white"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

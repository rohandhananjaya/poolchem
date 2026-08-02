"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import {
  AlertTriangle,
  Loader2,
  Minus,
  Plus,
  QrCode,
  ScanLine,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { lookupPoolFromScan, startVisitFromScan } from "./actions";

/** The element html5-qrcode mounts its <video> stream into. */
const READER_ID = "qr-reader";

type Status =
  | "starting" // initialising the camera
  | "scanning" // camera live, waiting for a code
  | "loading" // resolving a code / starting the visit
  | "confirm" // code resolved — asking the tech to confirm
  | "not-found" // code resolved to no pool in this company
  | "denied" // user blocked camera access
  | "no-camera" // no usable camera (typical on desktop)
  | "error"; // something unexpected (network, action failure)

/** True for the getUserMedia errors that mean the user refused permission. */
function isPermissionError(error: unknown): boolean {
  const name =
    typeof error === "object" && error && "name" in error
      ? String((error as { name: unknown }).name)
      : String(error);
  return /NotAllowed|Permission|Security/i.test(name);
}

/** Side (px) of the square scan region, responsive to the viewport. */
function scanBoxSize(): number {
  if (typeof window === "undefined") return 250;
  return Math.round(Math.min(Math.max(window.innerWidth * 0.72, 220), 300));
}

/**
 * Picks the rear camera explicitly by deviceId (more reliable than a
 * `facingMode` string in mobile WebViews, where camera selection can fail or
 * loop). Falls back to `facingMode: "environment"`.
 */
async function resolveCameraConfig(): Promise<
  { facingMode: string } | { deviceId: string }
> {
  try {
    const cameras = await Html5Qrcode.getCameras();
    const back =
      cameras.find((c) => /back|rear|environment/i.test(c.label)) ??
      cameras[0];
    if (back) return { deviceId: back.id };
  } catch {
    // Enumeration unsupported — fall through to facingMode.
  }
  return { facingMode: "environment" };
}

interface PendingPool {
  id: string;
  name: string;
  address: string | null;
}

export default function ScanPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>("starting");
  const [manualCode, setManualCode] = React.useState("");
  // Bumping this re-runs the camera effect (used by "Scan again").
  const [session, setSession] = React.useState(0);
  const [boxSize] = React.useState<number>(() => scanBoxSize());
  const [pendingPool, setPendingPool] = React.useState<PendingPool | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [zoomSupported, setZoomSupported] = React.useState(false);

  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  // Guards against the decode callback firing repeatedly for one code.
  const handledRef = React.useRef(false);
  // A code arriving via `?code=` deep link — skips the camera entirely.
  const deepLinkRef = React.useRef<string | null>(null);
  // The last resolved code, replayed into startVisitFromScan on confirm.
  const lastCodeRef = React.useRef<string | null>(null);
  const zoomMaxRef = React.useRef(1);

  // Whether we should be running the camera this render.
  const cameraActive = status === "starting" || status === "scanning";

  const resolveCode = React.useCallback(async (code: string) => {
    lastCodeRef.current = code;
    setStatus("loading");
    try {
      const result = await lookupPoolFromScan(code);
      if (result.ok) {
        setPendingPool(result.pool);
        setStatus("confirm");
        return;
      }
      setStatus("not-found");
    } catch {
      setStatus("error");
    }
  }, []);

  const handleStartVisit = React.useCallback(async () => {
    const code = lastCodeRef.current;
    if (!code) return;
    setStatus("loading");
    try {
      const result = await startVisitFromScan(code);
      if (result.ok) {
        router.push(`/visits/${result.visitId}`);
        return;
      }
      setStatus("not-found");
    } catch {
      setStatus("error");
    }
  }, [router]);

  // Deep link: /scan?code=<qrCode> — opened when a tech scans the pool QR with
  // the OS camera. Runs first so the camera effect sees deepLinkRef and skips.
  // The setState inside resolveCode is deferred off the synchronous effect
  // body to avoid cascading renders.
  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      deepLinkRef.current = code;
      handledRef.current = true;
      queueMicrotask(() => void resolveCode(code));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Own the camera lifecycle. Re-runs when we (re)start a scan session.
  React.useEffect(() => {
    if (!cameraActive || deepLinkRef.current) return;

    const scanner = new Html5Qrcode(READER_ID, {
      verbose: false,
      // BarcodeDetector is far better at locking onto small codes on mobile
      // than the fallback decoder.
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    });
    scannerRef.current = scanner;
    let cancelled = false;

    const configureZoom = () => {
      try {
        const zoomCap = scanner
          .getRunningTrackCameraCapabilities()
          .zoomFeature();
        if (zoomCap.isSupported()) {
          zoomMaxRef.current = zoomCap.max();
          setZoom(zoomCap.value() ?? zoomCap.min());
          setZoomSupported(true);
        }
      } catch {
        // Zoom unsupported — controls stay hidden.
      }
    };

    void (async () => {
      const cameraConfig = await resolveCameraConfig();
      if (cancelled) return;
      try {
        await scanner.start(
          cameraConfig,
          {
            fps: 10,
            qrbox: { width: boxSize, height: boxSize },
          },
          (decodedText) => {
            if (handledRef.current) return;
            handledRef.current = true;
            void resolveCode(decodedText);
          },
          // Per-frame "no code in view" — expected noise, ignore it.
          () => {},
        );
        if (!cancelled) {
          setStatus("scanning");
          configureZoom();
        }
      } catch (error: unknown) {
        if (cancelled) return;
        setStatus(isPermissionError(error) ? "denied" : "no-camera");
      }
    })();

    return () => {
      cancelled = true;
      // stop() throws *synchronously* (not just a rejected promise) when the
      // camera hasn't finished starting yet — e.g. an unmount that races
      // Html5Qrcode.start()'s init. Check state first, and keep the
      // try/catch as a backstop so that race can never crash the page.
      try {
        if (scanner.getState() !== Html5QrcodeScannerState.NOT_STARTED) {
          scanner.stop().catch(() => {}).finally(() => scanner.clear());
        } else {
          scanner.clear();
        }
      } catch {}
      scannerRef.current = null;
    };
    // `session` drives an explicit restart; cameraActive gates on/off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, cameraActive, boxSize]);

  const applyZoom = React.useCallback(async (next: number) => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try {
      const zoomCap = scanner.getRunningTrackCameraCapabilities().zoomFeature();
      if (!zoomCap.isSupported()) return;
      const clamped = Math.min(Math.max(next, zoomCap.min()), zoomCap.max());
      await zoomCap.apply(clamped);
      setZoom(clamped);
    } catch {
      // Zoom not available on this device — ignore.
    }
  }, []);

  function handleManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    const code = manualCode.trim();
    if (!code || status === "loading") return;
    handledRef.current = true;
    void resolveCode(code);
  }

  function scanAgain() {
    setManualCode("");
    setPendingPool(null);
    handledRef.current = false;
    deepLinkRef.current = null;
    lastCodeRef.current = null;
    setZoom(1);
    setZoomSupported(false);
    zoomMaxRef.current = 1;
    setStatus("starting");
    setSession((n) => n + 1);
  }

  function cancelConfirm() {
    if (deepLinkRef.current) router.back();
    else scanAgain();
  }

  const cameraFailed = status === "denied" || status === "no-camera";
  const showManualEntry =
    status === "not-found" || cameraFailed || status === "error";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Live camera stream fills the screen; object-cover avoids letterboxing. */}
      <div className={cn("absolute inset-0", !cameraActive && "hidden")}>
        <div
          id={READER_ID}
          className="h-full w-full [&_video]:!h-full [&_video]:!w-full [&_video]:object-cover"
        />
      </div>

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
          <div className="relative" style={{ width: boxSize, height: boxSize }}>
            {/* Corner brackets */}
            <span className="absolute left-0 top-0 size-8 rounded-tl-lg border-l-4 border-t-4 border-white" />
            <span className="absolute right-0 top-0 size-8 rounded-tr-lg border-r-4 border-t-4 border-white" />
            <span className="absolute bottom-0 left-0 size-8 rounded-bl-lg border-b-4 border-l-4 border-white" />
            <span className="absolute bottom-0 right-0 size-8 rounded-br-lg border-b-4 border-r-4 border-white" />
          </div>
        </div>
      ) : null}

      {/* Zoom controls — shown only when the camera track supports zoom. */}
      {status === "scanning" && zoomSupported ? (
        <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void applyZoom(zoom + 1)}
            aria-label="Zoom in"
            className="bg-black/40 text-white hover:bg-white/20 hover:text-white"
          >
            <Plus className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void applyZoom(zoom - 1)}
            aria-label="Zoom out"
            className="bg-black/40 text-white hover:bg-white/20 hover:text-white"
          >
            <Minus className="size-5" />
          </Button>
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

        {status === "error" ? (
          <div className="w-full max-w-sm rounded-xl bg-white/10 p-4 text-center backdrop-blur-sm">
            <p className="flex items-center justify-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 text-amber-400" /> Something went
              wrong
            </p>
            <p className="mt-1 text-xs text-white/70">
              We couldn&apos;t resolve that code. Check your connection and try
              again.
            </p>
            <Button
              variant="outline"
              size="lg"
              onClick={scanAgain}
              className="mt-3 border-white/30 bg-transparent text-white hover:bg-white/15 hover:text-white"
            >
              Try again
            </Button>
          </div>
        ) : null}

        {/* Manual entry: always offered as a fallback, plus after a miss. */}
        {showManualEntry ? (
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

      {/* Confirmation step — a visit is only created after the tech confirms. */}
      <Dialog
        open={status === "confirm"}
        onOpenChange={(open) => {
          if (!open) cancelConfirm();
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="size-4 text-brand-600" /> Start a service visit?
            </DialogTitle>
            <DialogDescription>
              {pendingPool ? (
                <>
                  <span className="block text-base font-semibold text-foreground">
                    {pendingPool.name}
                  </span>
                  {pendingPool.address ? (
                    <span className="block text-sm text-muted-foreground">
                      {pendingPool.address}
                    </span>
                  ) : null}
                  <span className="mt-2 block text-sm text-muted-foreground">
                    A new draft visit will be created and you&apos;ll be taken to
                    the service form.
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={cancelConfirm}>
              Cancel
            </Button>
            <Button onClick={() => void handleStartVisit()}>Start</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

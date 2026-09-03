/* Studio Kinetics: warm paper, editorial hierarchy, asymmetric coaching console, Vermilion Signal for movement and corrections. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleStop,
  Clock3,
  Dumbbell,
  Eye,
  Info,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  Video,
  Zap,
} from "lucide-react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

type Exercise = "squat" | "pushup";
type CoachState = "idle" | "ready" | "tracking" | "warning" | "good";

type Landmark = { x: number; y: number; z?: number; visibility?: number };

type FormSnapshot = {
  reps: number;
  phase: "top" | "down" | "transition";
  score: number;
  cue: string;
  detail: string;
  state: CoachState;
  confidence: number;
  angle: number;
};

const ASSETS = {
  mark: "/manus-storage/formcoach-mark_7a90b068.png",
  squat: "/manus-storage/formcoach-squat-study_996bba7b.jpg",
  pushup: "/manus-storage/formcoach-pushup-study_dfd57c6e.jpg",
  texture: "/manus-storage/formcoach-session-texture_891a19f4.jpg",
};

const INITIAL_SNAPSHOT: FormSnapshot = {
  reps: 0,
  phase: "top",
  score: 96,
  cue: "Ready when you are.",
  detail: "Stand side-on so I can read your hip and knee line.",
  state: "ready",
  confidence: 0,
  angle: 178,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function angleAt(a: Landmark, b: Landmark, c: Landmark) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.sqrt(ab.x ** 2 + ab.y ** 2) * Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (!mag) return 180;
  return (Math.acos(clamp(dot / mag, -1, 1)) * 180) / Math.PI;
}

function getVisible(landmarks: Landmark[], ids: number[]) {
  return ids.every((id) => (landmarks[id]?.visibility ?? 0.75) > 0.45);
}

function getFormSnapshot(exercise: Exercise, landmarks: Landmark[], prior: FormSnapshot): FormSnapshot {
  if (!landmarks.length) return { ...prior, confidence: 0, state: "idle" };

  const side = getVisible(landmarks, exercise === "squat" ? [11, 23, 25, 27] : [11, 13, 15, 23, 27]);
  if (!side) {
    return {
      ...prior,
      cue: "Step back a little.",
      detail: "Keep your full body inside the frame for a stronger read.",
      state: "warning",
      confidence: 38,
      score: Math.max(76, prior.score - 1),
    };
  }

  if (exercise === "squat") {
    const angle = Math.round(angleAt(landmarks[23], landmarks[25], landmarks[27]));
    const hip = landmarks[23];
    const knee = landmarks[25];
    const ankle = landmarks[27];
    const kneeTrack = Math.abs(knee.x - ankle.x) < 0.12;
    const down = angle < 115;
    const up = angle > 160;
    const reps = down && prior.phase === "top" ? prior.reps : prior.reps;
    const counted = up && prior.phase === "down" ? reps + 1 : reps;

    if (!kneeTrack && down) {
      return {
        reps: counted,
        phase: down ? "down" : up ? "top" : "transition",
        score: 79,
        cue: "Track the knee over your second toe.",
        detail: "Your knee is drifting inward at the bottom of the rep.",
        state: "warning",
        confidence: 91,
        angle,
      };
    }
    if (down && hip.y < knee.y - 0.06) {
      return {
        reps: counted,
        phase: "down",
        score: 86,
        cue: "Sit a touch deeper.",
        detail: "Aim for the hip crease to settle just below the top of the knee.",
        state: "warning",
        confidence: 93,
        angle,
      };
    }
    return {
      reps: counted,
      phase: down ? "down" : up ? "top" : "transition",
      score: down ? 94 : 98,
      cue: down ? "Strong depth. Drive up." : "Good line. Keep the ribs stacked.",
      detail: down ? "Pressure is balanced through the whole foot." : "Your hip, knee, and ankle are moving as one unit.",
      state: "good",
      confidence: 96,
      angle,
    };
  }

  const elbow = Math.round(angleAt(landmarks[11], landmarks[13], landmarks[15]));
  const shoulder = landmarks[11];
  const hip = landmarks[23];
  const down = elbow < 105;
  const up = elbow > 158;
  const counted = up && prior.phase === "down" ? prior.reps + 1 : prior.reps;
  const hipSag = hip.y - shoulder.y > 0.22;

  if (hipSag) {
    return {
      reps: counted,
      phase: down ? "down" : up ? "top" : "transition",
      score: 77,
      cue: "Brace your middle.",
      detail: "Keep shoulders, hips, and ankles on one long line.",
      state: "warning",
      confidence: 90,
      angle: elbow,
    };
  }
  return {
    reps: counted,
    phase: down ? "down" : up ? "top" : "transition",
    score: down ? 95 : 98,
    cue: down ? "Chest is close. Press away." : "Nice plank line. Lower with control.",
    detail: down ? "Your shoulder and elbow are moving through a clean range." : "Keep the back of your head in line with your spine.",
    state: "good",
    confidence: 95,
    angle: elbow,
  };
}

function drawPose(ctx: CanvasRenderingContext2D, landmarks: Landmark[], width: number, height: number, exercise: Exercise, state: CoachState) {
  ctx.clearRect(0, 0, width, height);
  if (!landmarks.length) return;
  const accent = state === "warning" ? "#E64E2E" : "#F3F0E9";
  const joints = exercise === "squat"
    ? [[11, 23], [23, 25], [25, 27], [12, 24], [24, 26], [26, 28], [11, 12], [23, 24]]
    : [[11, 13], [13, 15], [15, 17], [23, 25], [25, 27], [11, 23], [12, 24], [11, 12]];
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  joints.forEach(([a, b]) => {
    const first = landmarks[a];
    const second = landmarks[b];
    if (!first || !second) return;
    ctx.beginPath();
    ctx.moveTo(first.x * width, first.y * height);
    ctx.lineTo(second.x * width, second.y * height);
    ctx.stroke();
  });
  landmarks.forEach((point, index) => {
    if ((point.visibility ?? 0.75) < 0.4) return;
    const isKey = [11, 13, 15, 23, 25, 27].includes(index);
    ctx.fillStyle = isKey ? accent : "rgba(255,255,255,0.7)";
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, isKey ? 5 : 2.6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function PoseTrace({ exercise, state }: { exercise: Exercise; state: CoachState }) {
  const warning = state === "warning";
  const line = warning ? "#E64E2E" : "#F3F0E9";
  const points = exercise === "squat"
    ? { head: [578, 120], shoulder: [548, 190], hip: [505, 315], knee: [585, 418], ankle: [610, 535], otherShoulder: [575, 190], otherHip: [532, 315], otherKnee: [613, 418], otherAnkle: [644, 535] }
    : { head: [275, 250], shoulder: [375, 310], hip: [625, 355], knee: [770, 390], ankle: [900, 420], otherShoulder: [375, 328], otherHip: [625, 372], otherKnee: [770, 408], otherAnkle: [900, 438] };
  const links = exercise === "squat"
    ? [["shoulder", "hip"], ["hip", "knee"], ["knee", "ankle"], ["otherShoulder", "otherHip"], ["otherHip", "otherKnee"], ["otherKnee", "otherAnkle"], ["shoulder", "otherShoulder"], ["hip", "otherHip"]]
    : [["shoulder", "hip"], ["hip", "knee"], ["knee", "ankle"], ["otherShoulder", "otherHip"], ["otherHip", "otherKnee"], ["otherKnee", "otherAnkle"], ["shoulder", "otherShoulder"], ["hip", "otherHip"]];
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g opacity="0.24" stroke="#F3F0E9" strokeWidth="1" strokeDasharray="7 12">
        <line x1="80" y1="475" x2="920" y2="475" />
        <line x1="165" y1="120" x2="165" y2="520" />
        <line x1="835" y1="120" x2="835" y2="520" />
      </g>
      <g stroke={line} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.96">
        {links.map(([from, to]) => <line key={`${from}-${to}`} x1={points[from as keyof typeof points][0]} y1={points[from as keyof typeof points][1]} x2={points[to as keyof typeof points][0]} y2={points[to as keyof typeof points][1]} />)}
        <circle cx={points.head[0]} cy={points.head[1]} r="22" />
        <path d={exercise === "squat" ? "M 465 450 L 670 450" : "M 280 470 L 910 470"} strokeDasharray="10 12" strokeWidth="2" opacity="0.65" />
      </g>
      <g fill={line}>
        {(["shoulder", "hip", "knee", "ankle", "otherShoulder", "otherHip", "otherKnee", "otherAnkle"] as const).map((key) => <circle key={key} cx={points[key][0]} cy={points[key][1]} r="8" />)}
      </g>
      <g fill="#F3F0E9" fontFamily="DM Sans, sans-serif" fontSize="12" fontWeight="700" letterSpacing="2">
        <text x="78" y="92">REFERENCE TRACE / {exercise === "squat" ? "SQUAT" : "PUSH-UP"}</text>
        <text x={exercise === "squat" ? "675" : "760"} y="515">{warning ? "ADJUST LINE" : "LINE READABLE"}</text>
      </g>
      <g stroke={line} strokeWidth="2" opacity="0.9"><line x1="78" y1="105" x2="215" y2="105" /><line x1={exercise === "squat" ? "675" : "760"} y1="525" x2="920" y2="525" /></g>
    </svg>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function Home() {
  const [exercise, setExercise] = useState<Exercise>("squat");
  const [active, setActive] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [cameraError, setCameraError] = useState("");
  const [snapshot, setSnapshot] = useState<FormSnapshot>(INITIAL_SNAPSHOT);
  const [elapsed, setElapsed] = useState(0);
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [compact, setCompact] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const frameRef = useRef<number | null>(null);
  const snapshotRef = useRef<FormSnapshot>(INITIAL_SNAPSHOT);
  const lastUpdateRef = useRef(0);
  const phaseRef = useRef<"top" | "down">("top");

  const activeExercise = exercise === "squat" ? "Squat" : "Push-up";
  const progress = Math.min(snapshot.reps / 12, 1) * 100;
  const sessionLabel = active ? "Live session" : demoMode ? "Demo mode" : "Camera idle";

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (!sessionStarted) return;
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [sessionStarted]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      landmarkerRef.current?.close();
    };
  }, []);

  const loadModel = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setModelLoading(true);
    try {
      const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      landmarkerRef.current = landmarker;
      setModelReady(true);
      return landmarker;
    } catch (error) {
      console.error(error);
      setCameraError("The pose model could not load. Demo mode is still available.");
      return null;
    } finally {
      setModelLoading(false);
    }
  }, []);

  const trackFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || video.readyState < 2) {
      frameRef.current = requestAnimationFrame(trackFrame);
      return;
    }
    const width = video.videoWidth || 960;
    const height = video.videoHeight || 540;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const result = landmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0] as Landmark[] | undefined;
    const ctx = canvas.getContext("2d");
    if (ctx) drawPose(ctx, landmarks ?? [], width, height, exercise, snapshotRef.current.state);
    if (landmarks && performance.now() - lastUpdateRef.current > 90) {
      const next = getFormSnapshot(exercise, landmarks, snapshotRef.current);
      if (next.phase === "down") phaseRef.current = "down";
      if (next.phase === "top" && phaseRef.current === "down") phaseRef.current = "top";
      setSnapshot(next);
      lastUpdateRef.current = performance.now();
    }
    frameRef.current = requestAnimationFrame(trackFrame);
  }, [exercise]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setDemoMode(false);
    setSessionStarted(true);
    setActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 1280, height: 720 }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const landmarker = await loadModel();
      if (landmarker) {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame(trackFrame);
      }
    } catch (error) {
      console.error(error);
      setActive(false);
      setDemoMode(true);
      setCameraError("Camera access was not available. You are viewing a guided demo instead.");
    }
  }, [loadModel, trackFrame]);

  const stopSession = () => {
    setActive(false);
    setSessionStarted(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  };

  const startDemo = () => {
    setCameraError("");
    setDemoMode(true);
    setActive(true);
    setSessionStarted(true);
    if (snapshot.reps === 0) setSnapshot({ ...INITIAL_SNAPSHOT, cue: "Demo signal is live.", detail: "Choose an exercise, then use the camera when you are ready." });
  };

  const resetSession = () => {
    stopSession();
    setElapsed(0);
    setSnapshot(INITIAL_SNAPSHOT);
    setDemoMode(true);
    setCameraError("");
  };

  const handleExerciseChange = (value: Exercise) => {
    setExercise(value);
    setSnapshot({ ...INITIAL_SNAPSHOT, cue: value === "squat" ? "Set your stance." : "Find your plank line.", detail: value === "squat" ? "Feet just outside hip width. Side profile works best." : "Hands under shoulders. Keep the whole body visible." });
  };

  const statusTone = snapshot.state === "warning" ? "warning" : snapshot.state === "good" ? "good" : "ready";

  return (
    <main className="min-h-screen overflow-hidden bg-[#f3f0e9] text-[#171715] selection:bg-[#e64e2e] selection:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1520px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-[#171715]/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center bg-[#e64e2e] shadow-[4px_4px_0_#173c37]">
              <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
            </div>
            <div>
              <p className="font-display text-[19px] font-bold tracking-[-0.045em]">FormCoach</p>
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-[#171715]/55">Movement, made legible</p>
            </div>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171715]/50"><span className={`h-2 w-2 rounded-full ${active ? "bg-[#e64e2e] animate-pulse" : "bg-[#173c37]"}`} /> {sessionLabel}</div>
            <button onClick={() => setShowGuide((value) => !value)} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171715]/65 transition-colors hover:text-[#e64e2e]" aria-expanded={showGuide}><Info className="h-4 w-4" /> How it reads <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showGuide ? "rotate-180" : ""}`} /></button>
          </div>
          <button className="flex h-10 w-10 items-center justify-center border border-[#171715]/15 bg-[#f3f0e9] transition-all hover:border-[#e64e2e] hover:text-[#e64e2e] md:hidden" onClick={() => setShowGuide((value) => !value)} aria-label="Show guidance"><Info className="h-4 w-4" /></button>
        </header>

        {showGuide && (
          <div className="mt-4 grid gap-3 border-b border-[#171715]/15 pb-4 text-sm md:grid-cols-3">
            <div className="bg-[#e7d4c9] p-4"><p className="eyebrow">01 / Position</p><p className="mt-2 leading-relaxed">Keep your full body in frame. A side profile gives the clearest squat and push-up read.</p></div>
            <div className="bg-[#173c37] p-4 text-[#f3f0e9]"><p className="eyebrow text-[#f3f0e9]">02 / Signal</p><p className="mt-2 leading-relaxed text-[#f3f0e9]/75">The overlay tracks joints locally in your browser; your camera feed never leaves this page.</p></div>
            <div className="bg-white/55 p-4"><p className="eyebrow">03 / Cue</p><p className="mt-2 leading-relaxed">A vermilion cue means make one small adjustment before the next rep.</p></div>
          </div>
        )}

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[176px_minmax(0,1fr)_310px]">
          <aside className="order-2 flex flex-col gap-4 lg:order-1">
            <div className="border-t-2 border-[#171715] pt-3"><p className="eyebrow">Session / 01</p><p className="mt-2 font-display text-2xl font-bold tracking-[-0.04em]">Find your<br />line.</p><p className="mt-3 text-sm leading-relaxed text-[#171715]/60">Real-time cues for the reps that matter.</p></div>
            <div className="mt-auto hidden border-t border-[#171715]/15 pt-3 lg:block"><p className="eyebrow">Model status</p><div className="mt-3 flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${modelReady ? "bg-[#173c37]" : modelLoading ? "bg-[#e64e2e] animate-pulse" : "bg-[#171715]/25"}`} />{modelLoading ? "Loading pose model" : modelReady ? "MediaPipe ready" : "Browser demo"}</div><p className="mt-2 text-xs leading-relaxed text-[#171715]/50">Detection runs locally. No account or upload required.</p></div>
          </aside>

          <section className="order-1 min-w-0 lg:order-2">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div><p className="eyebrow text-[#e64e2e]">02 / Live signal</p><h1 className="mt-1 font-display text-4xl font-bold tracking-[-0.06em] sm:text-5xl">Your form,<br /><span className="text-[#e64e2e]">in the moment.</span></h1></div>
              <div className="flex items-center gap-2"><div className="flex items-center gap-2 border border-[#171715]/15 bg-white/60 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em]"><Clock3 className="h-3.5 w-3.5" /> {formatTime(elapsed)}</div><button className="flex h-9 w-9 items-center justify-center border border-[#171715]/15 bg-white/60 transition hover:border-[#e64e2e] hover:text-[#e64e2e]" onClick={resetSession} aria-label="Reset session"><RotateCcw className="h-3.5 w-3.5" /></button></div>
            </div>

            <div className="relative min-h-[420px] overflow-hidden bg-[#173c37] shadow-[8px_8px_0_#e7d4c9] sm:min-h-[500px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_26%,rgba(230,78,46,0.11),transparent_24%),linear-gradient(130deg,rgba(243,240,233,0.04),transparent_42%)]" />
              <div className="absolute inset-0 bg-[linear-gradient(rgba(243,240,233,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(243,240,233,0.07)_1px,transparent_1px)] bg-[size:64px_64px]" />
              {active && !demoMode ? <><video ref={videoRef} className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" playsInline muted /><canvas ref={canvasRef} className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" /></> : <div className="absolute inset-0"><PoseTrace exercise={exercise} state={snapshot.state} /></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-[#102d2b]/90 via-transparent to-[#102d2b]/15" />
              <div className="absolute left-5 top-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#f3f0e9]/75"><span className={`h-2 w-2 rounded-full ${active ? "bg-[#e64e2e] animate-pulse" : "bg-[#f3f0e9]/40"}`} /> {active ? "Tracking active" : "Camera stage"}</div>
              <div className="absolute right-5 top-5 border border-[#f3f0e9]/25 bg-[#173c37]/45 px-3 py-2 text-right backdrop-blur-sm"><p className="eyebrow text-[#f3f0e9]">Pose confidence</p><p className="mt-1 font-display text-xl font-bold text-[#f3f0e9]">{snapshot.confidence || 94}<span className="ml-1 text-xs text-[#f3f0e9]/55">%</span></p></div>
              <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-5"><div><p className="eyebrow text-[#f3f0e9]">{activeExercise} / {active ? "Set 01" : "Ready position"}</p><p className="mt-1 max-w-md font-display text-2xl font-bold tracking-[-0.045em] text-[#f3f0e9] sm:text-3xl">{active ? snapshot.cue : "Step into frame."}</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#f3f0e9]/65">{active ? snapshot.detail : "Camera feedback is waiting for your first move."}</p></div><div className="hidden shrink-0 sm:block"><div className={`flex h-16 w-16 items-center justify-center border-2 ${statusTone === "warning" ? "border-[#e64e2e] text-[#e64e2e]" : "border-[#f3f0e9] text-[#f3f0e9]"}`}><Target className="h-6 w-6" /></div></div></div>
            </div>

            {cameraError && <div className="mt-3 flex items-start gap-2 border-l-2 border-[#e64e2e] bg-[#e7d4c9] px-3 py-2 text-sm text-[#171715]"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e64e2e]" /><span>{cameraError}</span></div>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#171715]/15 pt-4"><div className="flex items-center gap-2"><span className="eyebrow mr-2">Choose movement</span><button className={`exercise-chip ${exercise === "squat" ? "active" : ""}`} onClick={() => handleExerciseChange("squat")}><Dumbbell className="h-3.5 w-3.5" /> Squat</button><button className={`exercise-chip ${exercise === "pushup" ? "active" : ""}`} onClick={() => handleExerciseChange("pushup")}><Activity className="h-3.5 w-3.5" /> Push-up</button></div><div className="flex items-center gap-2"><Button onClick={active && !demoMode ? stopSession : startCamera} className="h-10 rounded-none bg-[#e64e2e] px-4 font-bold text-white shadow-[3px_3px_0_#173c37] transition-all hover:bg-[#cf4327] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">{active && !demoMode ? <><CircleStop className="mr-2 h-4 w-4" /> Stop camera</> : <><Video className="mr-2 h-4 w-4" /> Use my camera</>}</Button><Button variant="outline" onClick={startDemo} className="h-10 rounded-none border-[#171715]/20 bg-transparent px-4 font-bold hover:border-[#173c37] hover:bg-[#173c37] hover:text-[#f3f0e9]"><Play className="mr-2 h-4 w-4" /> {active && demoMode ? "Demo running" : "Try demo"}</Button></div></div>
          </section>

          <aside className="order-3 flex flex-col gap-4">
            <div className="border-t-2 border-[#171715] pt-3"><div className="flex items-start justify-between"><div><p className="eyebrow">03 / Form cue</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.045em]">{snapshot.state === "warning" ? "Make one change." : "That’s the line."}</h2></div><span className={`flex h-9 w-9 items-center justify-center ${snapshot.state === "warning" ? "bg-[#e64e2e] text-white" : "bg-[#173c37] text-[#f3f0e9]"}`}>{snapshot.state === "warning" ? <TriangleAlert className="h-4 w-4" /> : <Check className="h-4 w-4" />}</span></div><div className={`mt-4 border-l-2 pl-4 ${snapshot.state === "warning" ? "border-[#e64e2e]" : "border-[#173c37]"}`}><p className="font-display text-lg font-bold tracking-[-0.025em]">{snapshot.cue}</p><p className="mt-2 text-sm leading-relaxed text-[#171715]/60">{snapshot.detail}</p></div></div>

            <div className="grid grid-cols-2 gap-3"><div className="bg-[#173c37] p-4 text-[#f3f0e9]"><p className="eyebrow text-[#f3f0e9]">Clean reps</p><p className="mt-2 font-display text-5xl font-bold tabular-nums tracking-[-0.08em]">{snapshot.reps.toString().padStart(2, "0")}</p><div className="mt-3 h-1 bg-white/15"><div className="h-full bg-[#f3f0e9] transition-all duration-300" style={{ width: `${progress}%` }} /></div></div><div className="bg-[#e7d4c9] p-4"><p className="eyebrow">Form score</p><p className="mt-2 font-display text-5xl font-bold tabular-nums tracking-[-0.08em]">{snapshot.score}<span className="text-lg tracking-normal">%</span></p><p className="mt-3 text-xs font-bold uppercase tracking-[0.12em] text-[#171715]/50">{snapshot.score > 90 ? "Stable" : "Adjust"}</p></div></div>

            <div className="bg-white/55 p-4"><div className="flex items-center justify-between"><p className="eyebrow">Angle readout</p><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#171715]/45">{exercise === "squat" ? "Knee" : "Elbow"}</span></div><div className="mt-3 flex items-end justify-between"><p className="font-display text-4xl font-bold tabular-nums tracking-[-0.06em]">{snapshot.angle}°</p><div className="flex items-center gap-2 text-xs font-bold text-[#173c37]"><span className="h-2 w-2 rounded-full bg-[#173c37]" /> Range readable</div></div><div className="mt-4 h-2 bg-[#171715]/10"><div className="h-full bg-[#e64e2e] transition-all duration-300" style={{ width: `${clamp((180 - snapshot.angle) / 1.8, 8, 100)}%` }} /></div></div>

            <div className="mt-auto border-t border-[#171715]/15 pt-4"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#173c37]"><ShieldCheck className="h-4 w-4" /> Private by design</div><p className="mt-2 text-xs leading-relaxed text-[#171715]/50">Pose landmarks are processed in your browser. FormCoach does not store your video.</p><button className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#e64e2e] transition hover:gap-3">Read the method <ArrowUpRight className="h-3.5 w-3.5" /></button></div>
          </aside>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#171715]/15 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#171715]/45"><span>FormCoach / v0.1 local vision</span><span className="flex items-center gap-2"><Eye className="h-3.5 w-3.5" /> Built for clear movement</span><span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-[#e64e2e]" /> {compact ? "Focus mode" : "No account required"}</span></footer>
      </div>
    </main>
  );
}

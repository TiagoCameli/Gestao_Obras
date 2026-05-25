import { useEffect, useRef, useState } from "react";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { preloadFaceModels } from "../utils/faceWorkerClient";
import { capturar3 } from "../utils/faceCaptureMultiFrame";
import { useAuth } from "../../../contexts/AuthContext";

interface Props {
  open: boolean;
  title: string;
  onCancel: () => void;
  onCapture: (dataUrl: string, position: GeolocationCoordinates | null) => void;
  // Reconhecimento facial: se referencias estão vazias, pula a verificação.
  validarFace?: (dataUrl: string) => Promise<{
    match: boolean;
    distancia: number;
    threshold: number;
  }>;
  /** Chamado após match positivo, antes do onCapture. Permite ao caller
   *  registrar a distância na batida. */
  onMatchResult?: (info: { distancia: number; threshold: number }) => void;
}

export default function CapturaFotoModal({
  open,
  title,
  onCancel,
  onCapture,
  validarFace,
  onMatchResult,
}: Props) {
  const { temAcao } = useAuth();
  const canCapturar = temAcao("captura_facial_ponto") || temAcao("registrar_ponto");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<GeolocationCoordinates | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [matchInfo, setMatchInfo] = useState<{
    match: boolean;
    distancia: number;
  } | null>(null);
  // Frontal por padrão (melhor pro reconhecimento facial); pode trocar.
  const [facing, setFacing] = useState<"user" | "environment">("user");

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMatchInfo(null);

    // Modelos do face-api carregam em paralelo enquanto o usuário se
    // posiciona — chega no clique de Capturar sem espera adicional.
    if (validarFace) preloadFaceModels().catch(() => {});

    // GPS obrigatório (seção 4.5 da spec)
    if (!navigator.geolocation) {
      setError("Geolocalização não disponível neste dispositivo.");
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords(pos.coords),
        (err) => setError("GPS bloqueado: " + err.message),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }
  }, [open]);

  // (Re)inicializa câmera quando abre ou ao trocar facing
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        // encerra stream anterior antes de pedir um novo
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            "Não foi possível acessar a câmera: " +
              (e instanceof Error ? e.message : String(e))
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, facing]);

  async function tirarFoto() {
    if (!videoRef.current) return;

    // Overlay com data/hora/GPS — fica idêntico ao atual, só extraído pra função
    const overlay = (ctx: CanvasRenderingContext2D, c: HTMLCanvasElement) => {
      const now = new Date();
      const stamp = now.toLocaleString("pt-BR");
      const coordStr = coords
        ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
        : "GPS indisponível";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, c.height - 60, c.width, 60);
      ctx.fillStyle = "#fff";
      ctx.font = "16px sans-serif";
      ctx.fillText(stamp, 12, c.height - 36);
      ctx.fillText(coordStr, 12, c.height - 14);
    };

    // Sem validarFace: fluxo antigo (1 frame)
    if (!validarFace) {
      const c = canvasRef.current!;
      const v = videoRef.current;
      c.width = v.videoWidth || 640;
      c.height = v.videoHeight || 480;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      overlay(ctx, c);
      const dataUrl = c.toDataURL("image/jpeg", 0.85);
      if (!canCapturar) return;
      onCapture(dataUrl, coords);
      return;
    }

    setVerificando(true);
    try {
      // capturar3 tira 3 frames com 250ms entre cada e chama computeDistance
      // (que aqui é o próprio validarFace, retornando distância via match).
      const { frames, melhor } = await capturar3(
        videoRef.current,
        async (dataUrl) => {
          const res = await validarFace(dataUrl);
          return res.distancia;
        },
        { overlay }
      );

      if (melhor.indice < 0) {
        setMatchInfo({ match: false, distancia: 1 });
        setVerificando(false);
        return;
      }

      const threshold = 0.55;
      const match = melhor.distancia < threshold;
      setMatchInfo({ match, distancia: melhor.distancia });
      if (!match) {
        setVerificando(false);
        return;
      }

      onMatchResult?.({ distancia: melhor.distancia, threshold });

      if (!canCapturar) return;
      onCapture(frames[melhor.indice].dataUrl, coords);
    } catch (e) {
      setError(
        "Falha no reconhecimento facial: " +
          (e instanceof Error ? e.message : String(e))
      );
    } finally {
      setVerificando(false);
    }
  }

  return (
    <Modal open={open} onClose={onCancel} title={title} size="lg">
      <div className="space-y-3">
        {error && (
          <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)] text-[var(--color-danger)] text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            playsInline
            muted
            className={
              "w-full h-full object-cover " +
              (facing === "user" ? "scale-x-[-1]" : "")
            }
          />
          <canvas ref={canvasRef} className="hidden" />
          {coords && (
            <span className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-white text-xs font-mono">
              📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
            title="Trocar câmera"
            className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/60 text-white text-lg flex items-center justify-center hover:bg-black/80"
          >
            ⤾
          </button>
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[11px]">
            {facing === "user" ? "Frontal" : "Traseira"}
          </span>
        </div>

        {matchInfo && !matchInfo.match && (
          <div className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)] text-[var(--color-danger)] text-sm rounded-lg p-3">
            ❌ Rosto não confere com o cadastrado (distância {matchInfo.distancia.toFixed(2)}). Tente novamente.
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel} disabled={verificando}>
            Cancelar
          </Button>
          <Button
            onClick={tirarFoto}
            disabled={verificando || !!error || !coords}
          >
            {verificando ? "Verificando rosto..." : "Capturar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

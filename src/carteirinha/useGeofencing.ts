import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface PontoGeo {
  id: string;
  lat: number | null;
  lng: number | null;
  raioMetros: number;
  nome: string;
}

interface EventoFila {
  tipo: "CHEGADA" | "SAIDA";
  pontoRotaId: string;
  dataIso: string;
  distanciaM?: number;
  idRecord: string; // Gerado no cliente para correlacionar chegada e saída
}

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Metros
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function useGeofencing(destinoId: string, pontos: PontoGeo[], tokenAPI: string | null) {
  const [ativo, setAtivo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pontoAtual, setPontoAtual] = useState<string | null>(null);
  const [distanciaAtual, setDistanciaAtual] = useState<number | null>(null);
  const [fila, setFila] = useState<EventoFila[]>([]);
  const idAtualRef = useRef<string | null>(null);
  
  // Carrega fila do localStorage ao iniciar
  useEffect(() => {
    try {
      const stored = localStorage.getItem("geofencing_fila");
      if (stored) setFila(JSON.parse(stored));
    } catch { /* */ }
  }, []);

  const salvarFila = (novaFila: EventoFila[]) => {
    setFila(novaFila);
    localStorage.setItem("geofencing_fila", JSON.stringify(novaFila));
  };

  const enfileirarEvento = useCallback((ev: Omit<EventoFila, "idRecord"> & { idRecord?: string }) => {
    let finalId = ev.idRecord;
    if (ev.tipo === "CHEGADA") {
      finalId = crypto.randomUUID();
      idAtualRef.current = finalId;
    } else if (!finalId) {
      finalId = idAtualRef.current ?? "";
    }
    
    setFila(f => {
      const nova = [...f, { ...ev, idRecord: finalId! }];
      localStorage.setItem("geofencing_fila", JSON.stringify(nova));
      return nova;
    });
  }, []);

  const sincronizar = useCallback(async () => {
    if (!navigator.onLine || fila.length === 0 || !tokenAPI || !destinoId) return;
    
    // Pega a fila atual e tenta enviar
    const aEnviar = [...fila];
    const filaRestante = [...fila];
    
    for (const ev of aEnviar) {
      try {
        const action = ev.tipo === "CHEGADA" ? "registrar-chegada" : "registrar-saida";
        const payload = { 
          action, 
          destinoId, 
          pontoRotaId: ev.pontoRotaId, 
          id: ev.idRecord,
          origem: "GPS" 
        } as Record<string, any>;
        
        if (ev.tipo === "CHEGADA") {
          payload.chegouEm = ev.dataIso;
          if (ev.distanciaM !== undefined) payload.distanciaM = ev.distanciaM;
        } else {
          payload.saiuEm = ev.dataIso;
        }

        const res = await supabase.functions.invoke("monitor", {
          body: payload,
          headers: { Authorization: `Bearer ${tokenAPI}` }
        });
        
        if (!res.error) {
          // Remove da fila restante
          const idx = filaRestante.findIndex(x => x === ev);
          if (idx !== -1) filaRestante.splice(idx, 1);
        }
      } catch (e) {
        console.error("Erro sincronizando", e);
        break; // Falhou, para de tentar e mantém o resto na fila
      }
    }
    salvarFila(filaRestante);
  }, [fila, tokenAPI, destinoId]);

  // Sincroniza sempre que a fila muda ou a conexão volta
  useEffect(() => {
    sincronizar();
  }, [fila, sincronizar]);
  
  useEffect(() => {
    const handleOnline = () => sincronizar();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [sincronizar]);

  // Watch position
  useEffect(() => {
    if (!ativo) return;
    if (!navigator.geolocation) {
      setErro("Geolocalização não suportada");
      return;
    }

    setErro(null);
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let achouPonto = false;

        for (const p of pontos) {
          if (p.lat && p.lng) {
            const dist = calcularDistancia(latitude, longitude, p.lat, p.lng);
            
            // Se entrou no raio
            if (dist <= p.raioMetros) {
              achouPonto = true;
              setDistanciaAtual(Math.round(dist));
              
              if (pontoAtual !== p.id) {
                // Saiu do anterior (se existia)
                if (pontoAtual) {
                  enfileirarEvento({ tipo: "SAIDA", pontoRotaId: pontoAtual, dataIso: new Date().toISOString() });
                }
                // Entrou no novo
                setPontoAtual(p.id);
                enfileirarEvento({ tipo: "CHEGADA", pontoRotaId: p.id, dataIso: new Date().toISOString(), distanciaM: Math.round(dist) });
              }
              break; // Um ponto de cada vez
            }
          }
        }

        // Se estava num ponto e agora não está em nenhum
        if (!achouPonto && pontoAtual) {
          enfileirarEvento({ tipo: "SAIDA", pontoRotaId: pontoAtual, dataIso: new Date().toISOString() });
          setPontoAtual(null);
          setDistanciaAtual(null);
        }
      },
      (err) => {
        setErro(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [ativo, pontos, pontoAtual, enfileirarEvento]);

  return { ativo, setAtivo, erro, pontoAtual, distanciaAtual, filaPendencias: fila.length };
}

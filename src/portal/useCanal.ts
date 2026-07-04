import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Assina um canal do Supabase Realtime (Broadcast). No modelo "enquete do
 * WhatsApp", o evento já traz a fila PRONTA no payload → o cliente só renderiza,
 * sem rebusca. Retorna se o canal está conectado (indicador "ao vivo").
 */
export function useCanal(topic: string, aoAtualizar: (payload?: unknown) => void): boolean {
  const ref = useRef(aoAtualizar);
  useEffect(() => {
    ref.current = aoAtualizar;
  }, [aoAtualizar]);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    const canal = supabase
      .channel(topic)
      .on("broadcast", { event: "update" }, (msg) => ref.current(msg?.payload))
      .subscribe((status) => setConectado(status === "SUBSCRIBED"));
    return () => {
      setConectado(false);
      supabase.removeChannel(canal);
    };
  }, [topic]);

  return conectado;
}

-- Migração de Fuso Horário (UTC -> Local Frontend Handling)
-- Essa migração converte colunas de `timestamp without time zone` para `timestamp with time zone` (timestamptz).
-- Garantindo que o `now()` gravado no Postgres em UTC traga o fuso correto (-03:00) quando entregue via JSON (Supabase).

-- Tabela Reserva
ALTER TABLE "Reserva" ALTER COLUMN "criadoEm" TYPE timestamptz USING "criadoEm" AT TIME ZONE 'UTC';

-- Tabela Viagem
ALTER TABLE "Viagem" ALTER COLUMN "data" TYPE date USING "data"::date; -- Data exata, sem necessidade de hora/minuto
ALTER TABLE "Viagem" ALTER COLUMN "criadoEm" TYPE timestamptz USING "criadoEm" AT TIME ZONE 'UTC';
ALTER TABLE "Viagem" ALTER COLUMN "abreEm" TYPE timestamptz USING "abreEm" AT TIME ZONE 'UTC';
ALTER TABLE "Viagem" ALTER COLUMN "fechaEm" TYPE timestamptz USING "fechaEm" AT TIME ZONE 'UTC';

-- Nota: RegistroPonto já estava em timestamptz.
